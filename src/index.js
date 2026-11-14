// Tamaq — Telegram calorie counter (Cloudflare Worker + D1 + Gemini).
import { buildPrompt, parseAI, ground, totals, parseUSDA } from "./nutrition.js";

const TZ_OFFSET_MIN = 5 * 60; // Kazakhstan, UTC+5
const DEFAULT_GOAL = 2000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/setup") {
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      return Response.json(await setup(env, `${url.origin}/telegram`));
    }

    if (request.method === "POST" && url.pathname === "/telegram") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const update = await request.json();
      // Answer Telegram at once; the AI call can take several seconds.
      ctx.waitUntil(handleUpdate(update, env).catch((e) => console.error("update failed", e?.stack || e)));
      return new Response("ok");
    }

    return new Response("Tamaq bot is running.");
  },
};

async function setup(env, webhookUrl) {
  const hook = await tg(env, "setWebhook", {
    url: webhookUrl,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const commands = await tg(env, "setMyCommands", {
    commands: [
      { command: "today", description: "Итог за сегодня" },
      { command: "undo", description: "Удалить последнюю запись" },
      { command: "goal", description: "Цель ккал в день, например /goal 1800" },
      { command: "help", description: "Как пользоваться" },
    ],
  });
  return { hook, commands };
}

// ---------- Telegram ----------

async function tg(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) console.error(method, JSON.stringify(json));
  return json;
}

const send = (env, chatId, text, extra = {}) =>
  tg(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

function allowed(env, userId) {
  const list = String(env.ALLOWED_USERS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(String(userId));
}

async function handleUpdate(update, env) {
  if (update.callback_query) return handleCallback(update.callback_query, env);
  const msg = update.message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!allowed(env, userId)) {
    return send(env, chatId, `Это личный бот. Ваш Telegram ID: <code>${userId}</code>`);
  }

  const text = (msg.text || msg.caption || "").trim();
  if (text.startsWith("/")) return handleCommand(env, chatId, text);

  if (msg.photo?.length || (msg.document && /^image\//.test(msg.document.mime_type || ""))) {
    const fileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : msg.document.file_id;
    return analyzeAndLog(env, chatId, text, fileId);
  }
  if (text) return analyzeAndLog(env, chatId, text, null);
  return send(env, chatId, "Пришлите фото еды или напишите, что вы съели.");
}

async function handleCommand(env, chatId, text) {
  const [cmdRaw, ...rest] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = rest.join(" ");

  if (cmd === "/start" || cmd === "/help") {
    return send(
      env,
      chatId,
      [
        "<b>Tamaq — счётчик калорий</b>",
        "",
        "📷 Пришлите фото еды (можно с подписью, например «порция на двоих»).",
        "✍️ Или напишите: <i>плов 300 г, айран стакан, 2 баурсака</i>.",
        "",
        "Я определю блюда и граммы, посчитаю КБЖУ и запишу в дневник.",
        "Казахские блюда (плов, бешбармак, манты, баурсаки, казы…) считаю по справочнику 📗.",
        "",
        "/today — итог за сегодня",
        "/undo — удалить последнюю запись",
        "/goal 1800 — цель ккал в день",
      ].join("\n")
    );
  }
  if (cmd === "/today") return send(env, chatId, await todaySummary(env, chatId));
  if (cmd === "/undo") {
    const last = await env.DB.prepare("SELECT id, title FROM meals WHERE chat_id = ? ORDER BY id DESC LIMIT 1").bind(chatId).first();
    if (!last) return send(env, chatId, "Записей пока нет.");
    await env.DB.prepare("DELETE FROM meals WHERE id = ?").bind(last.id).run();
    return send(env, chatId, `Удалено: ${esc(last.title)}\n\n${await todaySummary(env, chatId)}`);
  }
  if (cmd === "/goal") {
    const goal = parseInt(arg, 10);
    if (!(goal >= 800 && goal <= 6000)) return send(env, chatId, "Укажите цель в ккал, например: /goal 1800");
    await env.DB.prepare("INSERT INTO settings (chat_id, goal) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET goal = excluded.goal")
      .bind(chatId, goal)
      .run();
    return send(env, chatId, `Цель: ${goal} ккал в день ✅`);
  }
  return send(env, chatId, "Не знаю такой команды. /help");
}

async function handleCallback(cq, env) {
  const chatId = cq.message?.chat?.id;
  const [action, idRaw] = String(cq.data || "").split(":");
  if (action === "del" && chatId && allowed(env, cq.from?.id)) {
    await env.DB.prepare("DELETE FROM meals WHERE id = ? AND chat_id = ?").bind(parseInt(idRaw, 10), chatId).run();
    await tg(env, "editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Запись удалена" });
    return send(env, chatId, `🗑 Запись удалена.\n\n${await todaySummary(env, chatId)}`);
  }
  return tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
}

// ---------- Analysis ----------

async function analyzeAndLog(env, chatId, text, fileId) {
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });

  let image = null;
  if (fileId) {
    const file = await tg(env, "getFile", { file_id: fileId });
    if (!file.ok) return send(env, chatId, "Не получилось скачать фото, попробуйте ещё раз.");
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${file.result.file_path}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = /\.png$/i.test(file.result.file_path) ? "image/png" : "image/jpeg";
    image = { mime, data: base64(bytes) };
  }

  let parsed;
  try {
    parsed = parseAI(await gemini(env, buildPrompt(text, !!image), image));
  } catch (e) {
    console.error("AI failed", e?.stack || e);
    return send(env, chatId, "Не получилось распознать 😕 Попробуйте ещё раз или опишите текстом.");
  }
  if (!parsed.isFood) return send(env, chatId, "Не вижу здесь еды 🤔 Пришлите фото блюда или опишите, что съели.");

  const items = await ground(parsed.items, env.USDA_API_KEY ? (q) => usdaLookup(env, q) : null);
  const t = totals(items);
  const title = items.map((i) => i.name).join(", ").slice(0, 200);
  const { day, time } = localDay();
  const row = await env.DB.prepare(
    "INSERT INTO meals (chat_id, day, created_at, title, items_json, kcal, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id"
  )
    .bind(chatId, day, time, title, JSON.stringify(items), t.kcal, t.protein, t.carbs, t.fat)
    .first();

  const lines = items.map((i) => {
    const mark = i.source === "catalog" ? " 📗" : i.source === "usda" ? " 🇺🇸" : "";
    return `• <b>${esc(i.name)}</b>, ${Math.round(i.grams)} г — ${i.kcal} ккал${mark}\n   Б ${i.protein} · Ж ${i.fat} · У ${i.carbs}`;
  });
  const reply = [
    ...lines,
    "",
    `<b>Итого: ${t.kcal} ккал</b> (Б ${t.protein} · Ж ${t.fat} · У ${t.carbs})`,
    "",
    await todaySummary(env, chatId, true),
  ].join("\n");
  return send(env, chatId, reply, {
    reply_markup: { inline_keyboard: [[{ text: "🗑 Удалить запись", callback_data: `del:${row.id}` }]] },
  });
}

// Google sometimes answers 503 "high demand" for one model: fall through to the next.
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];

async function gemini(env, prompt, image) {
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  const models = [...new Set([env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean))];
  let lastError;
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    lastError = new Error(`Gemini ${model} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    console.error(lastError.message);
    if (![404, 429, 500, 503].includes(res.status)) break;
  }
  throw lastError;
}

async function usdaLookup(env, query) {
  try {
    const res = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Api-Key": env.USDA_API_KEY },
      body: JSON.stringify({ query, dataType: ["Foundation", "SR Legacy"], requireAllWords: true, pageSize: 5 }),
    });
    if (!res.ok) return null;
    return parseUSDA(await res.json());
  } catch {
    return null;
  }
}

// ---------- Diary ----------

async function todaySummary(env, chatId, short = false) {
  const { day } = localDay();
  const sum = await env.DB.prepare(
    "SELECT COUNT(*) n, COALESCE(SUM(kcal),0) kcal, COALESCE(SUM(protein),0) p, COALESCE(SUM(fat),0) f, COALESCE(SUM(carbs),0) c FROM meals WHERE chat_id = ? AND day = ?"
  )
    .bind(chatId, day)
    .first();
  const s = await env.DB.prepare("SELECT goal FROM settings WHERE chat_id = ?").bind(chatId).first();
  const goal = s?.goal || DEFAULT_GOAL;
  const left = goal - sum.kcal;
  const head = `📊 За сегодня: <b>${sum.kcal} / ${goal} ккал</b> (${left >= 0 ? `осталось ${left}` : `перебор ${-left}`})`;
  if (short) return head;
  if (!sum.n) return `${head}\nЗаписей за сегодня нет.`;
  const meals = await env.DB.prepare("SELECT created_at, title, kcal FROM meals WHERE chat_id = ? AND day = ? ORDER BY id").bind(chatId, day).all();
  const list = meals.results.map((m) => `${m.created_at} — ${esc(m.title)}: ${m.kcal} ккал`);
  return [head, `Б ${r1(sum.p)} · Ж ${r1(sum.f)} · У ${r1(sum.c)}`, "", ...list].join("\n");
}

// ---------- utils ----------

function localDay(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MIN * 60000);
  const iso = local.toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const r1 = (x) => Math.round(x * 10) / 10;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function base64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
