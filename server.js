import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import cron from "node-cron";
import TelegramBot from "node-telegram-bot-api";
import Database from "better-sqlite3";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// ---------- Database ----------
const db = new Database("planner.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    end_time TEXT,
    category TEXT,
    reminder_minutes INTEGER DEFAULT 0,
    done INTEGER DEFAULT 0,
    reminded INTEGER DEFAULT 0
  );
`);

// ---------- Telegram bot ----------
// Polling is simplest for getting started. Switch to webhooks (bot.setWebHook)
// once you deploy to a server with a stable HTTPS URL.
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const telegramId = msg.from.id;
  const chatId = msg.chat.id;
  db.prepare(
    "INSERT INTO users (telegram_id, chat_id) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET chat_id=excluded.chat_id"
  ).run(telegramId, chatId);
  bot.sendMessage(chatId, "Привет! Открой мини-приложение через кнопку меню, чтобы спланировать день. Я буду присылать напоминания о задачах сюда.");
});

// ---------- Verify Telegram Mini App requests ----------
// Every request from the Mini App must include Telegram's initData string
// (window.Telegram.WebApp.initData on the frontend) in the X-Telegram-Init-Data header.
// This function checks it really came from Telegram and wasn't tampered with.
function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computedHash !== hash) return null;
  const user = JSON.parse(params.get("user") || "{}");
  return { telegramId: user.id };
}

function requireTelegramUser(req, res, next) {
  const initData = req.header("X-Telegram-Init-Data");
  const verified = initData && verifyInitData(initData);
  if (!verified) return res.status(401).json({ error: "Invalid or missing Telegram init data" });
  req.telegramId = verified.telegramId;
  next();
}

// ---------- API ----------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/tasks", requireTelegramUser, (req, res) => {
  const rows = db.prepare("SELECT * FROM tasks WHERE telegram_id = ?").all(req.telegramId);
  res.json(rows);
});

app.post("/api/tasks", requireTelegramUser, (req, res) => {
  const { id, title, date, time, endTime, category, reminderMinutes } = req.body;
  db.prepare(
    "INSERT INTO tasks (id, telegram_id, title, date, time, end_time, category, reminder_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.telegramId, title, date, time || null, endTime || null, category || null, reminderMinutes || 0);
  res.status(201).json({ ok: true });
});

app.patch("/api/tasks/:id", requireTelegramUser, (req, res) => {
  const { done, date, time, endTime, title } = req.body;
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ? AND telegram_id = ?").get(req.params.id, req.telegramId);
  if (!existing) return res.status(404).json({ error: "Not found" });
  db.prepare(
    "UPDATE tasks SET done = ?, date = ?, time = ?, end_time = ?, title = ? WHERE id = ?"
  ).run(
    done !== undefined ? (done ? 1 : 0) : existing.done,
    date ?? existing.date,
    time ?? existing.time,
    endTime ?? existing.end_time,
    title ?? existing.title,
    req.params.id
  );
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", requireTelegramUser, (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ? AND telegram_id = ?").run(req.params.id, req.telegramId);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`API listening on :${PORT}`));

// ---------- Reminders ----------
// Runs every minute. For each task with a start time, computes when the
// reminder should fire (start time minus reminder_minutes) and sends it
// once that moment matches "now" to the minute.
cron.schedule("* * * * *", () => {
  const now = new Date();
  now.setSeconds(0, 0);

  const candidates = db.prepare(
    "SELECT * FROM tasks WHERE done = 0 AND reminded = 0 AND time IS NOT NULL"
  ).all();

  for (const task of candidates) {
    const [h, m] = task.time.split(":").map(Number);
    const [y, mo, d] = task.date.split("-").map(Number);
    const startAt = new Date(y, mo - 1, d, h, m);
    const remindAt = new Date(startAt.getTime() - (task.reminder_minutes || 0) * 60000);

    if (remindAt.getTime() !== now.getTime()) continue;

    const user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(task.telegram_id);
    if (!user) continue;

    const range = task.end_time ? `${task.time}–${task.end_time}` : task.time;
    const lead = task.reminder_minutes
      ? (task.reminder_minutes >= 60 ? `через ${task.reminder_minutes / 60} ч` : `через ${task.reminder_minutes} мин`)
      : "сейчас";
    bot.sendMessage(user.chat_id, `⏰ "${task.title}" (${range}) — начало ${lead}`);
    db.prepare("UPDATE tasks SET reminded = 1 WHERE id = ?").run(task.id);
  }
});
