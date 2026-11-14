CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  day TEXT NOT NULL,          -- YYYY-MM-DD, Kazakhstan time
  created_at TEXT NOT NULL,   -- HH:MM
  title TEXT NOT NULL,
  items_json TEXT NOT NULL,
  kcal INTEGER NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS meals_chat_day ON meals (chat_id, day);
CREATE TABLE IF NOT EXISTS settings (
  chat_id INTEGER PRIMARY KEY,
  goal INTEGER
);
