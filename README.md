# Tamaq — Telegram-бот для подсчёта калорий

Фото или текст → блюда, граммы, КБЖУ → дневник за день.
Работает на Cloudflare Workers (бесплатно) + D1, распознаёт Gemini.
Казахские и местные блюда считаются по встроенному справочнику (`src/catalog.js`, 30 блюд).

## Команды бота
- фото еды (можно с подписью) или текст «плов 300 г, айран»
- `/today` — итог за день, `/undo` — удалить последнее, `/goal 1800` — цель

## Развёртывание
```bash
npm install
npx wrangler d1 create tamaq-bot            # вставить database_id в wrangler.toml
npx wrangler d1 execute tamaq-bot --remote --file=schema.sql
npx wrangler secret put TELEGRAM_TOKEN      # от @BotFather
npx wrangler secret put GEMINI_API_KEY      # https://aistudio.google.com/apikey
npx wrangler secret put WEBHOOK_SECRET      # любая случайная строка
npx wrangler deploy
# открыть в браузере: https://tamaq-bot.<ваш-субдомен>.workers.dev/setup?key=<WEBHOOK_SECRET>
```
Чтобы бот отвечал только вам, впишите свой Telegram ID в `ALLOWED_USERS` в `wrangler.toml`
(бот покажет его чужим людям) и снова выполните `npx wrangler deploy`.

Тесты: `npm test`.
