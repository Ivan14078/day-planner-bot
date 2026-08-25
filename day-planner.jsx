import React, { useState, useEffect, useMemo } from "react";

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');";

const COLORS = {
  bg: "#F3F6EA",
  card: "#FFFEFA",
  green: "#5C8A43",
  greenDeep: "#3F6430",
  greenTint: "#E1EDCF",
  greenTintStrong: "#C9E0AC",
  orange: "#E88A4A",
  orangeDeep: "#B5601F",
  orangeTint: "#FBE4CE",
  ink: "#33392A",
  inkMuted: "#7C8368",
  border: "#E4E3D6",
  danger: "#C4562F",
};

const CATEGORIES = [
  { id: "work", label: "Работа", color: COLORS.green, tint: COLORS.greenTint },
  { id: "personal", label: "Личное", color: COLORS.orange, tint: COLORS.orangeTint },
  { id: "health", label: "Здоровье", color: "#4C8FA0", tint: "#DCEEF2" },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "Вовремя" },
  { value: 5, label: "За 5 мин" },
  { value: 15, label: "За 15 мин" },
  { value: 30, label: "За 30 мин" },
  { value: 60, label: "За 1 час" },
  { value: 180, label: "За 3 часа" },
  { value: 1440, label: "За 1 день" },
];

function reminderLabel(mins) {
  const opt = REMINDER_OPTIONS.find(o => o.value === mins);
  return opt ? opt.label : null;
}

function pad(n) { return String(n).padStart(2, "0"); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function todayKey() { return toKey(new Date()); }
function fmtDay(k) {
  const d = fromKey(k);
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}
function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }

const SEED = [
  { id: "s1", title: "Утренняя пробежка", time: "07:30", endTime: "08:00", date: todayKey(), done: false, category: "health", reminderMinutes: 0 },
  { id: "s2", title: "Созвон с командой", time: "10:00", endTime: "11:00", date: todayKey(), done: false, category: "work", reminderMinutes: 15 },
  { id: "s3", title: "Купить продукты", time: "18:30", endTime: "", date: todayKey(), done: false, category: "personal", reminderMinutes: 60 },
];

export default function DayPlanner() {
  const [tasks, setTasks] = useState(SEED);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(todayKey());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState("work");
  const [reminderMinutes, setReminderMinutes] = useState(0);
  const [movingId, setMovingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("tasks", false);
        if (res && res.value) setTasks(JSON.parse(res.value));
      } catch (e) { /* no saved data yet */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("tasks", JSON.stringify(tasks), false).catch(() => {});
  }, [tasks, loaded]);

  const dayTasks = useMemo(
    () => tasks.filter(t => t.date === selected).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [tasks, selected]
  );

  const overdue = useMemo(
    () => tasks.filter(t => !t.done && t.date < todayKey()).sort((a, b) => a.date.localeCompare(b.date)),
    [tasks]
  );

  const progress = dayTasks.length ? Math.round((dayTasks.filter(t => t.done).length / dayTasks.length) * 100) : 0;

  const tasksByDate = useMemo(() => {
    const m = {};
    tasks.forEach(t => { m[t.date] = m[t.date] || { total: 0, done: 0 }; m[t.date].total++; if (t.done) m[t.date].done++; });
    return m;
  }, [tasks]);

  function addTask() {
    if (!title.trim()) { setError("Введите название задачи"); return; }
    if (time && endTime && endTime <= time) { setError("Время окончания должно быть позже начала"); return; }
    if (reminderMinutes > 0 && !time) { setError("Укажите время начала, чтобы поставить напоминание заранее"); return; }
    setError("");
    setTasks(ts => [...ts, { id: String(Date.now()), title: title.trim(), time, endTime, date: selected, done: false, category, reminderMinutes: Number(reminderMinutes) }]);
    setTitle(""); setTime(""); setEndTime(""); setReminderMinutes(0);
  }

  function toggleDone(id) { setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t)); }
  function deleteTask(id) { setTasks(ts => ts.filter(t => t.id !== id)); }
  function reschedule(id, newDate) { setTasks(ts => ts.map(t => t.id === id ? { ...t, date: newDate } : t)); setMovingId(null); }

  const monthLabel = viewMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", background: COLORS.bg, color: COLORS.ink, padding: "24px", borderRadius: "16px", maxWidth: "760px" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "20px" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "28px", margin: 0, color: COLORS.greenDeep }}>План дня</h1>
        <span style={{ fontSize: "13px", color: COLORS.inkMuted }}>{tasks.filter(t => !t.done).length} задач впереди</span>
      </div>

      {overdue.length > 0 && (
        <div style={{ background: COLORS.orangeTint, border: `1px solid ${COLORS.orange}`, borderRadius: "12px", padding: "12px 16px", marginBottom: "18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: COLORS.orangeDeep, marginBottom: "8px" }}>Просроченные задачи</div>
          {overdue.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: "14px" }}>
              <span>{t.title} <span style={{ color: COLORS.inkMuted, fontSize: "12px" }}>({fromKey(t.date).toLocaleDateString("ru-RU")})</span></span>
              <button onClick={() => reschedule(t.id, todayKey())} style={{ border: "none", background: COLORS.orange, color: "#fff", borderRadius: "8px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>Перенести на сегодня</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px" }}>
        {/* Calendar */}
        <div style={{ background: COLORS.card, borderRadius: "16px", padding: "16px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} style={arrowBtn}>‹</button>
            <span style={{ fontSize: "14px", fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</span>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} style={arrowBtn}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", fontSize: "11px", color: COLORS.inkMuted, marginBottom: "4px" }}>
            {weekDays.map(w => <div key={w} style={{ textAlign: "center" }}>{w}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = toKey(d);
              const info = tasksByDate[key];
              const isSelected = key === selected;
              const isToday = key === todayKey();
              return (
                <button key={i} onClick={() => setSelected(key)} style={{
                  border: "none", cursor: "pointer", borderRadius: "8px", height: "34px",
                  background: isSelected ? COLORS.green : isToday ? COLORS.greenTintStrong : "transparent",
                  color: isSelected ? "#fff" : COLORS.ink,
                  fontWeight: isToday ? 600 : 400, fontSize: "13px", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
                }}>
                  {d.getDate()}
                  {info && <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: isSelected ? "#fff" : (info.done === info.total ? COLORS.green : COLORS.orange) }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day view */}
        <div style={{ background: COLORS.card, borderRadius: "16px", padding: "18px 20px", border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ textTransform: "capitalize", fontWeight: 600, fontSize: "15px" }}>{fmtDay(selected)}</div>
            <DayArc progress={progress} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {dayTasks.length === 0 && (
              <div style={{ fontSize: "13px", color: COLORS.inkMuted, padding: "10px 0" }}>На этот день пока нет задач.</div>
            )}
            {dayTasks.map(t => {
              const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[0];
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: t.done ? COLORS.greenTint : "#FBFAF4", border: `1px solid ${COLORS.border}` }}>
                  <button onClick={() => toggleDone(t.id)} aria-label="Отметить выполненной" style={{
                    width: "20px", height: "20px", borderRadius: "50%", border: `2px solid ${t.done ? COLORS.green : COLORS.inkMuted}`,
                    background: t.done ? COLORS.green : "transparent", cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: "12px", lineHeight: "16px",
                  }}>{t.done ? "✓" : ""}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", textDecoration: t.done ? "line-through" : "none", color: t.done ? COLORS.inkMuted : COLORS.ink }}>{t.title}</div>
                    <div style={{ fontSize: "11px", color: COLORS.inkMuted, display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                      {t.time && <span>{t.time}{t.endTime ? `–${t.endTime}` : ""}</span>}
                      <span style={{ background: cat.tint, color: cat.color, padding: "1px 8px", borderRadius: "8px" }}>{cat.label}</span>
                      {!!t.reminderMinutes && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: COLORS.orangeDeep }}>
                          🔔 {reminderLabel(t.reminderMinutes)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setMovingId(movingId === t.id ? null : t.id)} title="Перенести" style={iconBtn}>↻</button>
                  <button onClick={() => deleteTask(t.id)} title="Удалить" style={iconBtn}>✕</button>
                  {movingId === t.id && (
                    <input type="date" defaultValue={t.date} onChange={e => e.target.value && reschedule(t.id, e.target.value)} style={{ position: "absolute", marginTop: "40px" }} />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: "12px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                placeholder="Новая задача"
                value={title}
                onChange={e => { setTitle(e.target.value); if (error) setError(""); }}
                style={{ flex: "1 1 160px", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "13px" }}
              />
              <input type="time" value={time} onChange={e => { setTime(e.target.value); if (error) setError(""); }} style={{ padding: "8px 10px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "13px" }} />
              <span style={{ alignSelf: "center", color: COLORS.inkMuted, fontSize: "13px" }}>–</span>
              <input type="time" value={endTime} onChange={e => { setEndTime(e.target.value); if (error) setError(""); }} style={{ padding: "8px 10px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "13px" }} />
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: "8px 10px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "13px" }}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select
                value={reminderMinutes}
                onChange={e => { setReminderMinutes(Number(e.target.value)); if (error) setError(""); }}
                title="Предупредить заранее"
                style={{ padding: "8px 10px", borderRadius: "8px", border: `1px solid ${COLORS.border}`, fontSize: "13px", color: reminderMinutes ? COLORS.orangeDeep : COLORS.ink }}
              >
                {REMINDER_OPTIONS.map(o => <option key={o.value} value={o.value}>🔔 {o.label}</option>)}
              </select>
              <button onClick={addTask} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Добавить</button>
            </div>
            {error && <div style={{ color: COLORS.danger, fontSize: "12px", marginTop: "6px" }}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayArc({ progress }) {
  const r = 20, cx = 24, cy = 24;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - progress / 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <svg width="48" height="28" viewBox="0 0 48 28">
        <path d={`M 4 24 A ${r} ${r} 0 0 1 44 24`} fill="none" stroke={COLORS.greenTint} strokeWidth="5" strokeLinecap="round" />
        <path d={`M 4 24 A ${r} ${r} 0 0 1 44 24`} fill="none" stroke={COLORS.orange} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span style={{ fontSize: "12px", color: COLORS.inkMuted }}>{progress}%</span>
    </div>
  );
}

const arrowBtn = { border: "none", background: "transparent", fontSize: "16px", cursor: "pointer", color: COLORS.green, padding: "2px 8px" };
const iconBtn = { border: "none", background: "transparent", cursor: "pointer", color: COLORS.inkMuted, fontSize: "14px", padding: "2px 4px" };
