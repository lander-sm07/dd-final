// Date helpers + the "type it naturally" quick-add parser. No browser APIs, so the
// reminder script can reuse it too.

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  return Math.round((parseYmd(dateStr) - startOfDay(now)) / 86400000);
}

export function urgency(task, now = new Date()) {
  if (task.status === "done") return { cls: "u-done", label: "Done" };
  const d = daysUntil(task.due_date, now);
  if (d === null) return { cls: "u-later", label: "No date" };
  if (d < 0) return { cls: "u-overdue", label: d === -1 ? "1 day late" : `${-d} days late` };
  if (d === 0) return { cls: "u-today", label: "Today" };
  if (d === 1) return { cls: "u-urgent", label: "Tomorrow" };
  if (d <= 3) return { cls: "u-urgent", label: `${d} days` };
  if (d <= 7) return { cls: "u-soon", label: `${d} days` };
  return { cls: "u-later", label: `${d} days` };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const fmtShort = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS[d.getMonth()][0].toUpperCase()}${MONTHS[d.getMonth()].slice(1)}`; };
export const fmtTime = (t) => (t ? t.slice(0, 5) : "");

export function relLabel(dateStr, now = new Date()) {
  const d = daysUntil(dateStr, now);
  if (d === null) return "";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return parseYmd(dateStr).toLocaleDateString("en-GB", { weekday: "short" });
  return fmtShort(dateStr);
}

// ── Quick-add parser ─────────────────────────────────────────────
// "SKIL report friday 23:59", "Linux Web exam 1 dec", "todo buy printer ink tomorrow !"
const MONTH_WORDS = {
  jan: 0, january: 0, januari: 0, feb: 1, february: 1, februari: 1, mar: 2, march: 2, maart: 2, mrt: 2,
  apr: 3, april: 3, may: 4, mei: 4, jun: 5, june: 5, juni: 5, jul: 6, july: 6, juli: 6, aug: 7, august: 7, augustus: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, okt: 9, oktober: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = {
  sun: 0, sunday: 0, zo: 0, zondag: 0, mon: 1, monday: 1, ma: 1, maandag: 1, tue: 2, tues: 2, tuesday: 2, di: 2, dinsdag: 2,
  wed: 3, wednesday: 3, wo: 3, woensdag: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, do: 4, donderdag: 4,
  fri: 5, friday: 5, vr: 5, vrijdag: 5, sat: 6, saturday: 6, za: 6, zaterdag: 6,
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function quickParse(input, courses = [], now = new Date()) {
  let text = " " + input.trim() + " ";
  const out = { title: "", course: null, kind: "deadline", due_date: null, due_time: null, starred: false };
  const take = (re, fn) => { const m = text.match(re); if (m && fn(m) !== false) { text = text.replace(m[0], " "); return true; } return false; };
  const today = startOfDay(now);
  const futureYear = (m, d) => { let x = new Date(today.getFullYear(), m, d); if (x < today) x = new Date(today.getFullYear() + 1, m, d); return x; };
  let date = null;

  // flags
  take(/\s!(?=\s)/, () => { out.starred = true; });
  if (take(/\s(?:#?todo|#?to-do|#task):?(?=\s)/i, () => {})) out.kind = "todo";

  // time: 23:59, 14u, 14u30, 9am, 9pm (optionally preceded by at/om)
  take(/\s(?:at\s|om\s|@)?([01]?\d|2[0-3])(?::([0-5]\d)|[uh]([0-5]\d)?)(?=\s)/i, (m) => { out.due_time = `${pad(+m[1])}:${m[2] || m[3] || "00"}`; }) ||
    take(/\s(?:at\s|om\s|@)?(1[0-2]|0?[1-9])\s?(am|pm)(?=\s)/i, (m) => (out.due_time = `${pad((+m[1] % 12) + (m[2].toLowerCase() === "pm" ? 12 : 0))}:00`));

  // relative words
  take(/\s(?:due\s|on\s|by\s|tegen\s)?(today|tonight|vandaag)(?=\s)/i, () => { date = today; }) ||
  take(/\s(?:due\s|on\s|by\s|tegen\s)?(day after tomorrow|overmorgen)(?=\s)/i, () => (date = addDays(today, 2))) ||
  take(/\s(?:due\s|on\s|by\s|tegen\s)?(tomorrow|tmrw|morgen)(?=\s)/i, () => (date = addDays(today, 1))) ||
  take(/\sin\s(\d+)\s(days?|dagen|dag|weeks?|weken|week)(?=\s)/i, (m) => (date = addDays(today, +m[1] * (/^w/i.test(m[2]) ? 7 : 1)))) ||
  // 12/12, 12-12, 12/12/2026, 12.12
  take(/\s(?:due\s|on\s|by\s)?(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?(?=\s)/, (m) => {
    const d = +m[1], mo = +m[2] - 1;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) return false;
    date = m[3] ? new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], mo, d) : futureYear(mo, d);
  }) ||
  // 12 dec / dec 12
  take(new RegExp(`\\s(?:due\\s|on\\s|by\\s)?(\\d{1,2})(?:st|nd|rd|th)?\\s(${Object.keys(MONTH_WORDS).join("|")})\\.?(?=\\s)`, "i"),
    (m) => { if (+m[1] < 1 || +m[1] > 31) return false; date = futureYear(MONTH_WORDS[m[2].toLowerCase()], +m[1]); }) ||
  take(new RegExp(`\\s(?:due\\s|on\\s|by\\s)?(${Object.keys(MONTH_WORDS).join("|")})\\.?\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, "i"),
    (m) => { if (+m[2] < 1 || +m[2] > 31) return false; date = futureYear(MONTH_WORDS[m[1].toLowerCase()], +m[2]); }) ||
  // (next) friday / vrijdag  — Dutch 2-letter abbreviations only count if not the first word
  take(new RegExp(`\\s(?:due\\s|on\\s|by\\s)?(next\\s|volgende\\s)?(${Object.keys(WEEKDAYS).filter((w) => w.length > 2).join("|")})(?=\\s)`, "i"), (m) => {
    const target = WEEKDAYS[m[2].toLowerCase()];
    let diff = (target - today.getDay() + 7) % 7;
    if (m[1]) diff += diff === 0 ? 7 : 7;
    date = addDays(today, diff);
  });
  if (date) out.due_date = ymd(date);

  // course: longest name match, anywhere, whole word
  const sorted = [...courses].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    const re = new RegExp(`\\s#?${esc(c.name)}(?=[\\s:,-])`, "i");
    if (re.test(text)) { text = text.replace(re, " "); out.course = c.name; break; }
  }

  // exam detection keeps the word in the title
  if (out.kind !== "todo" && /\b(exam|examen|test|quiz|toets)\b/i.test(text)) out.kind = "exam";

  out.title = text.replace(/\s+/g, " ").replace(/^[\s:,\-–]+|[\s:,\-–]+$/g, "").replace(/\s(?:due|on|by|at|om|tegen)$/i, "").trim();
  if (out.title) out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}
