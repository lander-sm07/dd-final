import { CONFIG } from "./config.js";
import { createStore } from "./store.js";
import { ymd, parseYmd, addDays, startOfDay, daysUntil, urgency, relLabel, fmtShort, fmtTime, quickParse } from "./dates.js";

// ── Icons ─────────────────────────────────────────────────────────
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20"/>',
  cal: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
  planner: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
};
const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PALETTE = ["#3B9BFF", "#7C9CFF", "#2EC4B6", "#F6AD55", "#F687B3", "#48BB78", "#9F7AEA", "#F56565", "#0BC5EA", "#ECC94B"];
const KIND = { deadline: { label: "Deadline", icon: "doc" }, exam: { label: "Exam", icon: "cap" }, todo: { label: "To-do", icon: "todo" } };
const QUOTES = ["Keep going, you're doing great. 💙", "Small steps every day.", "Done is better than perfect.", "Future you says thanks.", "One task at a time."];
const EXAM_COLOR = "var(--exam)";
const isMobile = () => matchMedia("(max-width: 760px)").matches;

// ── State ─────────────────────────────────────────────────────────
const S = {
  store: null, tasks: [], courses: [], notes: [], study: [], settings: {}, canvas: [],
  view: localStorage.getItem("dd-view") || "dashboard",
  calMonth: startOfDay(new Date()), selectedDay: null, todoTab: "open", weekOffset: 0,
  bigMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1), bigSelected: null,
  filters: { kind: "all", course: "", showDone: false, q: "" },
  qa: "", wx: null,
};
const root = document.getElementById("root");
const courseColor = (name) => S.courses.find((c) => c.name === name)?.color || "#8796b6";
const byDue = (a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || (a.due_time || "99").localeCompare(b.due_time || "99");
const open = () => S.tasks.filter((t) => t.status !== "done");
const mondayOf = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const newCanvas = () => S.canvas.filter((c) => !c.seen);
const fmtRange = (a, b) => a.getMonth() === b.getMonth()
  ? `${a.getDate()} – ${b.getDate()} ${b.toLocaleDateString("en-GB", { month: "short" })}`
  : `${a.getDate()} ${a.toLocaleDateString("en-GB", { month: "short" })} – ${b.getDate()} ${b.toLocaleDateString("en-GB", { month: "short" })}`;
const longDate = (s) => parseYmd(s).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

// ── Theme ─────────────────────────────────────────────────────────
const theme = () => document.documentElement.dataset.theme || "light";
function toggleTheme() {
  const t = theme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("dd-theme", t); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#060a15" : "#eef4fc");
  render();
}

// ── Boot ──────────────────────────────────────────────────────────
async function boot() {
  try {
    S.store = await createStore();
    const session = await S.store.session();
    if (!session) return renderLogin();
    await loadAll();
    render();
    loadWeather();
    setInterval(tickClock, 1000);
    let lastDay = ymd(new Date());
    setInterval(() => { if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); render(); } }, 60000);
    document.addEventListener("visibilitychange", async () => {
      if (!document.hidden && S.store.mode === "cloud" && !document.getElementById("modal")) { await loadAll(); render(); }
    });
  } catch (e) {
    root.innerHTML = `<div class="login"><div class="card"><h1>Something went wrong</h1><p class="error">${esc(e.message)}</p><p>Try refreshing. If it keeps happening, send Claude this message.</p></div></div>`;
    console.error(e);
  }
}
async function loadAll() {
  [S.tasks, S.courses, S.notes, S.study, S.settings, S.canvas] = await Promise.all([
    S.store.getTasks(), S.store.getCourses(), S.store.getNotes(), S.store.getStudy(), S.store.getSettings(), S.store.getCanvas(),
  ]);
}

function renderLogin(err = "") {
  root.innerHTML = `<div class="login"><form class="card" id="login-form">
    <div class="logo" style="margin:0 0 18px">${ic("check", 22)}</div>
    <h1>Welcome back</h1><p>Sign in to see your deadlines.</p>
    <div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="username" required></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
    <div class="error">${esc(err)}</div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px">Sign in</button></form></div>`;
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { await S.store.signIn(f.get("email"), f.get("password")); location.reload(); }
    catch (er) { renderLogin(er.message); }
  };
}

// ── Main render ───────────────────────────────────────────────────
const VIEWS = {
  dashboard: { icon: "home", tip: "Dashboard", fn: () => viewDashboard() },
  calendar: { icon: "cal", tip: "Calendar", fn: () => viewCalendar() },
  tasks: { icon: "list", tip: "All tasks", fn: () => viewTasks() },
  planner: { icon: "planner", tip: "Exam planner", fn: () => viewPlanner() },
  canvas: { icon: "bell", tip: "New on Canvas", fn: () => viewCanvas() },
  courses: { icon: "book", tip: "Courses", fn: () => viewCourses() },
};
function render() {
  if (!VIEWS[S.view]) S.view = "dashboard";
  const nNew = newCanvas().length;
  const nav = (v, tip = true) => `<button class="nav-btn ${S.view === v ? "active" : ""}" data-action="view" data-v="${v}" ${tip ? `data-tip="${VIEWS[v].tip}"` : ""}>${ic(VIEWS[v].icon, 20)}${v === "canvas" && nNew ? `<span class="badge">${nNew}</span>` : ""}</button>`;
  const moreActive = ["planner", "canvas", "courses"].includes(S.view);
  root.innerHTML = `<div class="app">
    <aside class="sidebar">
      <div class="logo">${ic("check", 22)}</div>
      ${Object.keys(VIEWS).map((v) => nav(v)).join("")}
      <div class="spacer"></div>
      <button class="nav-btn" data-action="add" data-tip="New task">${ic("plus", 20)}</button>
      <button class="nav-btn" data-action="theme" data-tip="${theme() === "dark" ? "Light mode" : "Dark mode"}">${ic(theme() === "dark" ? "sun" : "moon", 20)}</button>
      ${S.store.mode === "cloud" ? `<button class="nav-btn" data-action="logout" data-tip="Sign out">${ic("logout", 20)}</button>` : ""}
    </aside>
    <main class="main">${banners()}${VIEWS[S.view].fn()}</main>
  </div>
  <nav class="mobile-nav">
    ${nav("dashboard", false)}${nav("calendar", false)}
    <button class="fab" data-action="add">${ic("plus", 24)}</button>
    ${nav("tasks", false)}
    <button class="nav-btn ${moreActive ? "active" : ""}" data-action="more">${ic("more", 20)}${nNew ? `<span class="badge">${nNew}</span>` : ""}</button>
  </nav>`;
  bindQuickAdd();
  tickClock();
  paintWeather();
}

function banners() {
  let b = "";
  if (S.store.mode === "demo") b += `<div class="banner">✨ Demo mode: your data is saved in this browser only. Connect Supabase (see the setup guide) to sync with your phone.
    <button class="btn btn-ghost btn-sm" data-action="reset-demo">Reset demo data</button></div>`;
  if (S.store.missing) b += `<div class="banner">🛠️ Almost there: run <b>supabase/002_v2.sql</b> in the Supabase SQL Editor to switch on the exam planner and the Canvas tab.</div>`;
  return b;
}

// ── Dashboard ─────────────────────────────────────────────────────
function viewDashboard() {
  const h = new Date().getHours();
  const greet = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `
  <header class="header">
    <div class="greet"><h1>${greet}${CONFIG.NAME ? `,<br><span class="name">${esc(CONFIG.NAME)}</span>` : ""} 👋</h1><p>${esc(CONFIG.TAGLINE)}</p></div>
    <div class="clock"><div class="time" id="clock-time"></div><div class="date" id="clock-date"></div>
      <button class="icon-btn theme-mobile" data-action="theme" title="Switch theme">${ic(theme() === "dark" ? "sun" : "moon", 16)}</button></div>
  </header>
  ${quickAddBar()}
  <div class="grid">
    <section class="card span-4 o-cal">${calendarCard()}</section>
    <section class="card span-4 o-agenda">${weekCard()}</section>
    <section class="card span-4 nextup-card o-next">${nextUpCard()}</section>
    <section class="card span-7 o-todo">${todoCard()}</section>
    <section class="card span-5 o-wx" id="wx-card">${weatherCard()}</section>
    <section class="card span-7 o-dead">${deadlinesCard()}</section>
    <section class="card span-5 o-notes">${notesCard()}</section>
    <section class="card span-12 o-courses">${coursesStrip()}</section>
  </div>`;
}

function quickAddBar() {
  return `<div class="quickadd">
    <form class="bar" id="qa-form">
      <span style="color:var(--accent);display:grid">${ic("plus", 20)}</span>
      <input id="qa" autocomplete="off" placeholder="Add anything… e.g. “SKIL hostingrapport friday 23:59” or “todo print notes tomorrow”" value="${esc(S.qa)}">
      <button type="button" class="icon-btn" data-action="qa-more" title="More options" style="width:38px;height:38px">${ic("sliders", 17)}</button>
      <button class="btn btn-primary" style="padding:10px 18px">Add</button>
    </form>
    <div id="qa-preview"></div>
  </div>`;
}
function qaPreviewHtml() {
  if (!S.qa.trim()) return `<div class="qa-hint">Tip: type a course name, a day (“friday”, “12 dec”, “in 3 days”), a time (“23:59”), “exam”, “todo” or “!” for important.</div>`;
  const p = quickParse(S.qa, S.courses);
  const chips = [
    `<span class="chip chip-preview">${ic(KIND[p.kind].icon, 12)} ${KIND[p.kind].label}</span>`,
    p.title && `<span class="chip chip-preview">“${esc(p.title)}”</span>`,
    p.course && `<span class="chip chip-course"><span class="dot" style="background:${courseColor(p.course)}"></span>${esc(p.course)}</span>`,
    p.due_date ? `<span class="chip chip-preview">📅 ${relLabel(p.due_date)} · ${fmtShort(p.due_date)}</span>` : `<span class="chip u-later">no date</span>`,
    p.due_time && `<span class="chip chip-preview">🕑 ${p.due_time}</span>`,
    p.starred && `<span class="chip chip-preview">⭐ important</span>`,
  ].filter(Boolean).join("");
  return `<div class="qa-preview">${chips}</div>`;
}
function bindQuickAdd() {
  const input = document.getElementById("qa");
  const prev = document.getElementById("qa-preview");
  if (!input) return;
  prev.innerHTML = qaPreviewHtml();
  input.oninput = () => { S.qa = input.value; prev.innerHTML = qaPreviewHtml(); };
  document.getElementById("qa-form").onsubmit = async (e) => {
    e.preventDefault();
    const p = quickParse(S.qa, S.courses);
    if (!p.title) return input.focus();
    await createTask(p);
    S.qa = ""; render(); document.getElementById("qa")?.focus();
  };
}

function calendarCard() {
  const m = S.calMonth, first = new Date(m.getFullYear(), m.getMonth(), 1);
  const start = mondayOf(first);
  const today = ymd(new Date());
  const byDay = {};
  for (const t of open()) if (t.due_date) (byDay[t.due_date] ||= []).push(t);
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), k = ymd(d), items = byDay[k] || [];
    if (i === 35 && d.getMonth() !== m.getMonth()) break;
    const marks = items.slice(0, 3).map((t) => `<i style="background:${t.kind === "exam" ? EXAM_COLOR : courseColor(t.course)}"></i>`).join("");
    cells += `<button class="day ${d.getMonth() !== m.getMonth() ? "other" : ""} ${k === today ? "today" : ""} ${k === S.selectedDay ? "selected" : ""}"
      data-action="pick-day" data-d="${k}" title="${items.map((t) => esc(t.title)).join("\n")}">${d.getDate()}${marks ? `<span class="marks">${marks}</span>` : ""}</button>`;
  }
  return `<div class="card-head"><h2>Calendar</h2><div class="cal-nav">
      <button class="icon-btn" data-action="cal" data-d="-1">${ic("left", 15)}</button>
      <span class="cal-month">${m.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
      <button class="icon-btn" data-action="cal" data-d="1">${ic("right", 15)}</button></div></div>
    <div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells}</div>`;
}

function agendaItem(t) {
  const d = parseYmd(t.due_date), today = ymd(new Date());
  return `<div class="agenda-item ${t.due_date === today ? "is-today" : ""}" style="--c:${t.kind === "exam" ? EXAM_COLOR : courseColor(t.course)}" data-action="edit" data-id="${t.id}">
    <div class="when"><b>${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()}</b>${t.due_time ? fmtTime(t.due_time) : KIND[t.kind].label}</div>
    <div class="what"><div>${esc(t.title)}</div><small>${esc(t.course || "No course")}${t.status === "working" ? " · in progress" : ""}${t.due_date < today ? " · overdue" : ""}</small></div></div>`;
}
function studyItem(b) {
  const d = parseYmd(b.date);
  return `<div class="agenda-item study ${b.done ? "past" : ""}" style="--c:${courseColor(b.course)}" data-action="block" data-id="${b.id}">
    <div class="when"><b>${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()}</b>Study</div>
    <div class="what"><div>📖 ${esc(b.course || "Study")}${b.topic ? `: ${esc(b.topic)}` : ""}</div><small>Exam planner${b.done ? " · done" : ""}</small></div></div>`;
}

function weekCard() {
  if (S.selectedDay) {
    const items = open().filter((t) => t.due_date === S.selectedDay).sort(byDue);
    const blocks = S.study.filter((b) => b.date === S.selectedDay);
    return `<div class="card-head"><h2>${parseYmd(S.selectedDay).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</h2>
      <button class="btn btn-ghost btn-sm" data-action="pick-day" data-d="">Back to week</button></div>
      <div class="agenda">${items.map(agendaItem).join("") + blocks.map(studyItem).join("") || `<div class="empty">Nothing on this day.<br><br><button class="btn btn-ghost btn-sm" data-action="add" data-date="${S.selectedDay}">${ic("plus", 13)} Add something</button></div>`}</div>`;
  }
  const start = addDays(mondayOf(new Date()), S.weekOffset * 7), end = addDays(start, 6);
  const a = ymd(start), b = ymd(end);
  const items = open().filter((t) => t.due_date && t.due_date >= a && t.due_date <= b).sort(byDue);
  const blocks = S.study.filter((x) => x.date >= a && x.date <= b);
  const merged = [...items.map((t) => [t.due_date + (t.due_time || "23:59"), agendaItem(t)]), ...blocks.map((x) => [x.date + "00:00", studyItem(x)])].sort((p, q) => p[0].localeCompare(q[0]));
  const title = { 0: "This week", 1: "Next week", "-1": "Last week" }[S.weekOffset] ?? `Week of ${start.getDate()} ${start.toLocaleDateString("en-GB", { month: "short" })}`;
  return `<div class="card-head"><h2>${title} <span class="sub">${fmtRange(start, end)}</span></h2><div class="cal-nav">
      ${S.weekOffset ? `<button class="btn btn-ghost btn-sm" data-action="week" data-d="0">Today</button>` : ""}
      <button class="icon-btn" data-action="week" data-d="${S.weekOffset - 1}">${ic("left", 15)}</button>
      <button class="icon-btn" data-action="week" data-d="${S.weekOffset + 1}">${ic("right", 15)}</button></div></div>
    <div class="agenda">${merged.length ? merged.map((m) => m[1]).join("") : `<div class="empty">Nothing due this week 🎉</div>`}</div>`;
}

function nextUpCard() {
  const next = open().filter((t) => t.due_date && t.kind !== "todo" && daysUntil(t.due_date) >= 0).sort(byDue)[0];
  const mon = ymd(mondayOf(new Date())), sun = ymd(addDays(mondayOf(new Date()), 6)), weekAgo = addDays(new Date(), -7).toISOString();
  const dueWeek = open().filter((t) => t.due_date && t.due_date >= mon && t.due_date <= sun).length;
  const overdue = open().filter((t) => t.due_date && daysUntil(t.due_date) < 0).length;
  const doneWeek = S.tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= weekAgo).length;
  let body = `<div class="empty">No upcoming deadlines. Enjoy it! 🌙</div>`;
  if (next) {
    const d = daysUntil(next.due_date);
    const big = d === 0 ? `Today` : `${d}<small>day${d === 1 ? "" : "s"} left</small>`;
    body = `<div style="cursor:pointer" data-action="edit" data-id="${next.id}">
      <div class="big" style="color:${d <= 1 ? "var(--warn)" : "var(--text)"}">${big}</div>
      <div class="title">${esc(next.title)}</div>
      <div class="meta">${next.course ? `<span class="chip chip-course"><span class="dot" style="background:${courseColor(next.course)}"></span>${esc(next.course)}</span>` : ""}
        <span>${KIND[next.kind].label} · ${longDate(next.due_date)}${next.due_time ? " · " + fmtTime(next.due_time) : ""}</span></div></div>`;
  }
  return `<div class="nextup"><div class="card-head"><h2>Next up</h2></div>${body}
    <div class="stats"><div class="stat"><b>${dueWeek}</b><span>this week</span></div>
    <div class="stat"><b style="color:${overdue ? "var(--danger)" : "inherit"}">${overdue}</b><span>overdue</span></div>
    <div class="stat"><b style="color:var(--ok)">${doneWeek}</b><span>done (7d)</span></div></div></div>`;
}

function taskRow(t, { showKind = false } = {}) {
  const u = urgency(t);
  const kindIco = showKind ? `<span class="kind-ico" style="background:${t.kind === "exam" ? EXAM_COLOR : courseColor(t.course)}">${ic(KIND[t.kind].icon, 17)}</span>` : "";
  return `<div class="row ${t.status === "done" ? "is-done" : ""}" data-action="edit" data-id="${t.id}">
    <button class="check ${t.status}" data-action="toggle" data-id="${t.id}" title="${t.status === "done" ? "Mark as not done" : "Mark as done"}">${ic("check", 12)}</button>
    ${kindIco}
    <div class="body"><div class="title">${esc(t.title)}</div>
      <div class="meta">${t.course ? `<span class="chip chip-course"><span class="dot" style="background:${courseColor(t.course)}"></span>${esc(t.course)}</span>` : ""}
      ${t.status === "working" ? `<span class="chip u-urgent">In progress</span>` : ""}
      ${t.due_date ? `<span>${fmtShort(t.due_date)}${t.due_time ? " · " + fmtTime(t.due_time) : ""}</span>` : ""}</div></div>
    <div class="right"><span class="chip ${u.cls}">${u.label}</span>
      <button class="star ${t.starred ? "on" : ""}" data-action="star" data-id="${t.id}" title="Important">${ic("star", 17)}</button></div></div>`;
}

function todoCard() {
  const todos = S.tasks.filter((t) => t.kind === "todo");
  const today = ymd(new Date());
  const tabs = { open: "Open", today: "Today", upcoming: "Upcoming", done: "Completed" };
  const filt = {
    open: (t) => t.status !== "done",
    today: (t) => t.status !== "done" && t.due_date && t.due_date <= today,
    upcoming: (t) => t.status !== "done" && t.due_date && t.due_date > today,
    done: (t) => t.status === "done",
  }[S.todoTab];
  const list = todos.filter(filt).sort(S.todoTab === "done" ? (a, b) => (b.completed_at || "").localeCompare(a.completed_at || "") : byDue);
  return `<div class="card-head"><h2>To-dos</h2><button class="btn btn-primary btn-sm" data-action="add" data-kind="todo">${ic("plus", 14)} Add to-do</button></div>
    <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="tab ${S.todoTab === k ? "active" : ""}" data-action="todo-tab" data-t="${k}">${v}</button>`).join("")}</div>
    <div class="list scroll">${list.length ? list.map((t) => taskRow(t)).join("") : `<div class="empty">Nothing here.</div>`}</div>`;
}

function deadlinesCard() {
  const list = open().filter((t) => t.kind !== "todo").sort(byDue);
  return `<div class="card-head"><h2>Upcoming deadlines <span class="sub">${list.length} open</span></h2>
    <button class="btn btn-ghost btn-sm" data-action="view" data-v="tasks">View all</button></div>
    <div class="list scroll" style="max-height:400px">${list.length ? list.map((t) => taskRow(t, { showKind: true })).join("") : `<div class="empty">No deadlines. 🎉</div>`}</div>`;
}

function notesCard() {
  return `<div class="card-head"><h2>Quick notes</h2></div>
    <div class="notes">${S.notes.length ? S.notes.map((n) => `<div class="note"><span>${esc(n.text)}</span><button class="icon-btn" data-action="del-note" data-id="${n.id}" title="Remove">${ic("x", 13)}</button></div>`).join("") : `<div class="empty">No notes yet.</div>`}</div>
    <form class="note-add" id="note-form"><input class="input" name="text" placeholder="Jot something down…" autocomplete="off"><button class="btn btn-ghost">${ic("plus", 15)}</button></form>
    <div class="motivation">${QUOTES[new Date().getDate() % QUOTES.length]}</div>`;
}

function coursesStrip() {
  return `<div class="card-head"><h2>Courses</h2><button class="btn btn-ghost btn-sm" data-action="view" data-v="courses">Manage</button></div>
    <div class="courses-strip">${S.courses.map((c) => {
      const n = open().filter((t) => t.course === c.name).length;
      return `<div class="course-pill"><span class="sw" style="background:${c.color}"></span>
        <div class="nm"><div>${esc(c.name)}</div><small>${n} open</small></div>
        ${c.canvas_url ? `<a class="icon-btn" href="${esc(c.canvas_url)}" target="_blank" rel="noopener" title="Open Canvas">${ic("ext", 14)}</a>` : ""}</div>`;
    }).join("") || `<div class="empty">No courses yet.</div>`}</div>`;
}

// ── Weather (Nijlen, Open-Meteo: free, no key) ───────────────────
const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=51.16&longitude=4.67&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBrussels&forecast_days=5";
const WMO = {
  0: ["☀️", "Clear sky"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Cloudy"], 45: ["🌫️", "Fog"], 48: ["🌫️", "Freezing fog"],
  51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"], 56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
  61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"], 66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
  80: ["🌦️", "Rain showers"], 81: ["🌧️", "Rain showers"], 82: ["⛈️", "Heavy showers"], 85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm, hail"], 99: ["⛈️", "Thunderstorm, hail"],
};
const wmo = (c, day = 1) => { const [i, l] = WMO[c] || ["🌡️", "—"]; return [!day && c <= 1 ? "🌙" : i, l]; };
async function loadWeather(force = false) {
  try {
    const cached = JSON.parse(localStorage.getItem("dd-wx") || "null");
    if (!force && cached && Date.now() - cached.t < 30 * 60e3) { S.wx = cached.d; paintWeather(); return; }
    const r = await fetch(WX_URL);
    if (!r.ok) throw new Error(r.status);
    S.wx = await r.json();
    localStorage.setItem("dd-wx", JSON.stringify({ t: Date.now(), d: S.wx }));
  } catch (e) { if (!S.wx) S.wx = { error: true }; }
  paintWeather();
}
function weatherCard() {
  const head = `<div class="card-head"><h2>Weather <span class="sub">Nijlen</span></h2><button class="icon-btn" data-action="wx-refresh" title="Refresh">${ic("reset", 14)}</button></div>`;
  const w = S.wx;
  if (!w) return head + `<div class="empty">Loading the weather…</div>`;
  if (w.error) return head + `<div class="empty">Couldn't load the weather right now.</div>`;
  const c = w.current, d = w.daily, [icon, label] = wmo(c.weather_code, c.is_day);
  const days = [1, 2, 3, 4].map((i) => {
    const [di] = wmo(d.weather_code[i]);
    const name = parseYmd(d.time[i]).toLocaleDateString("en-GB", { weekday: "short" });
    return `<div class="wx-day"><b>${i === 1 ? "Tmrw" : name}</b><span class="i">${di}</span>${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°<div class="rain">💧 ${d.precipitation_probability_max[i] ?? 0}%</div></div>`;
  }).join("");
  return `${head}<div class="weather">
    <div class="wx-now"><div class="wx-icon">${icon}</div>
      <div><div class="wx-temp">${Math.round(c.temperature_2m)}<small>°C</small></div><div class="wx-desc">${label}</div></div></div>
    <div class="wx-meta"><span>↑ ${Math.round(d.temperature_2m_max[0])}°  ↓ ${Math.round(d.temperature_2m_min[0])}°</span><span>Feels like ${Math.round(c.apparent_temperature)}°</span>
      <span>💨 ${Math.round(c.wind_speed_10m)} km/h</span><span>💧 ${d.precipitation_probability_max[0] ?? 0}% today</span></div>
    <div class="wx-days">${days}</div></div>`;
}
function paintWeather() { const el = document.getElementById("wx-card"); if (el) el.innerHTML = weatherCard(); }

// ── Calendar view ─────────────────────────────────────────────────
function dayEvents(k) {
  const tasks = S.tasks.filter((t) => t.due_date === k).sort((a, b) => (b.kind === "exam") - (a.kind === "exam") || byDue(a, b));
  const blocks = S.study.filter((b) => b.date === k);
  return { tasks, blocks };
}
function evHtml(t) {
  return `<div class="ev ${t.kind === "exam" ? "exam" : ""} ${t.status === "done" ? "done" : ""}" style="--c:${t.kind === "exam" ? EXAM_COLOR : courseColor(t.course)}" data-action="edit" data-id="${t.id}" title="${esc(t.title)}">${t.due_time ? fmtTime(t.due_time) + " " : ""}${t.kind === "exam" ? "🎓 " : ""}${esc(t.title)}</div>`;
}
function blockEv(b) {
  return `<div class="ev study ${b.done ? "done" : ""}" style="--c:${courseColor(b.course)}" data-action="block" data-id="${b.id}" title="Study: ${esc(b.course)} ${esc(b.topic)}">📖 ${esc(b.course || "Study")}${b.topic ? ": " + esc(b.topic) : ""}</div>`;
}
function viewCalendar() {
  const m = S.bigMonth, start = mondayOf(m), today = ymd(new Date());
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), k = ymd(d);
    if (i === 35 && d.getMonth() !== m.getMonth()) break;
    const { tasks, blocks } = dayEvents(k);
    const evs = [...tasks.map(evHtml), ...blocks.map(blockEv)];
    const dots = [...tasks.map((t) => (t.kind === "exam" ? EXAM_COLOR : courseColor(t.course))), ...blocks.map((b) => courseColor(b.course))].slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("");
    cells += `<div class="mday ${d.getMonth() !== m.getMonth() ? "other" : ""} ${k === today ? "today" : ""} ${k === S.bigSelected ? "selected" : ""}" data-action="mday" data-d="${k}">
      <span class="num">${d.getDate()}</span><span class="add-hint">${ic("plus", 14)}</span>
      ${evs.slice(0, 3).join("")}${evs.length > 3 ? `<div class="ev more">+${evs.length - 3} more</div>` : ""}
      <span class="dots">${dots}</span></div>`;
  }
  let panel = "";
  if (S.bigSelected) {
    const { tasks, blocks } = dayEvents(S.bigSelected);
    panel = `<div class="card day-panel"><div class="card-head"><h2>${longDate(S.bigSelected)}</h2>
      <button class="btn btn-primary btn-sm" data-action="add" data-date="${S.bigSelected}">${ic("plus", 14)} Add on this day</button></div>
      <div class="list">${tasks.map((t) => taskRow(t, { showKind: true })).join("") + blocks.map((b) => `<div class="row" data-action="block" data-id="${b.id}"><span class="kind-ico" style="background:${courseColor(b.course)}">📖</span><div class="body"><div class="title">${esc(b.course || "Study")}${b.topic ? ": " + esc(b.topic) : ""}</div><div class="meta">Exam planner${b.done ? " · done" : ""}</div></div></div>`).join("")
      || `<div class="empty">Nothing planned on this day.</div>`}</div></div>`;
  }
  return `<div class="page-head"><div><h1>Calendar</h1><p>${isMobile() ? "Tap a day to see it or add something." : "Click a day to add something on that date. Click an item to edit it."}</p></div>
      <div class="actions">
        <button class="btn btn-ghost" data-action="bigcal-today">Today</button>
        <button class="icon-btn" style="width:36px;height:36px" data-action="bigcal" data-d="-1">${ic("left", 16)}</button>
        <b style="min-width:140px;text-align:center;font-size:15px">${m.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <button class="icon-btn" style="width:36px;height:36px" data-action="bigcal" data-d="1">${ic("right", 16)}</button>
        <button class="btn btn-primary hide-mobile" data-action="add">${ic("plus", 15)} New</button></div></div>
    <div class="card" style="padding:14px">
      <div class="month">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="dow">${isMobile() ? d[0] : d}</div>`).join("")}${cells}</div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Deadline / to-do (course colour)</span><span><i style="background:var(--exam)"></i>Exam</span><span><i style="border:1.5px dashed var(--muted)"></i>Study block (exam planner)</span></div>
    </div>${panel}`;
}

// ── Exam planner ──────────────────────────────────────────────────
function plannerRange() {
  const defStart = ymd(mondayOf(new Date()));
  const start = S.settings.exam_start || defStart;
  const end = S.settings.exam_end || ymd(addDays(parseYmd(start), 34));
  return { start, end: end < start ? start : end };
}
function viewPlanner() {
  const { start, end } = plannerRange();
  const today = ymd(new Date());
  const exams = S.tasks.filter((t) => t.kind === "exam" && t.due_date >= start && t.due_date <= end);
  const blocks = S.study.filter((b) => b.date >= start && b.date <= end);
  // summary per course
  const names = [...new Set([...exams.map((e) => e.course), ...blocks.map((b) => b.course)].filter(Boolean))];
  const summary = names.map((n) => {
    const ex = exams.filter((e) => e.course === n).sort(byDue)[0];
    const bl = blocks.filter((b) => b.course === n), done = bl.filter((b) => b.done).length;
    const dl = ex ? daysUntil(ex.due_date) : null;
    return `<div class="plan-course" style="--c:${courseColor(n)}"><b>${esc(n)}</b>
      <small>${ex ? `🎓 ${fmtShort(ex.due_date)} · ${dl < 0 ? "done" : dl === 0 ? "today!" : `in ${dl} day${dl === 1 ? "" : "s"}`}` : "No exam in this period"}</small>
      <small>${done}/${bl.length} study blocks done</small>
      <div class="bar-track"><div class="bar-fill" style="width:${bl.length ? (done / bl.length) * 100 : 0}%"></div></div></div>`;
  }).join("");
  // grid
  let rows = "", wk = mondayOf(parseYmd(start)), n = 1;
  while (ymd(wk) <= end) {
    let cells = "";
    for (let i = 0; i < 7; i++) {
      const d = addDays(wk, i), k = ymd(d), out = k < start || k > end;
      const ex = exams.filter((e) => e.due_date === k), bl = blocks.filter((b) => b.date === k);
      cells += `<div class="pday ${out ? "out" : ""} ${ex.length ? "exam-day" : ""} ${k === today ? "today" : ""}" ${out ? "" : `data-action="plan-day" data-d="${k}"`}>
        <div class="d"><span>${d.getDate()}${d.getDate() === 1 || i === 0 ? " " + d.toLocaleDateString("en-GB", { month: "short" }) : ""}</span></div>
        ${ex.map((e) => `<div class="exam-tag" data-action="edit" data-id="${e.id}">🎓 ${esc(e.course || e.title)}</div>`).join("")}
        ${bl.map((b) => `<div class="block ${b.done ? "done" : ""}" style="--c:${courseColor(b.course)}" data-action="block" data-id="${b.id}">
          <input type="checkbox" ${b.done ? "checked" : ""} data-action="block-toggle" data-id="${b.id}" title="Done"><span><b>${esc(b.course || "")}</b>${b.topic ? (b.course ? ": " : "") + esc(b.topic) : ""}</span></div>`).join("")}
      </div>`;
    }
    rows += `<div class="plan-week"><div class="wk"><b>Week ${n}</b>${fmtRange(wk, addDays(wk, 6))}</div>${cells}</div>`;
    wk = addDays(wk, 7); n++;
  }
  return `<div class="page-head"><div><h1>Exam planner</h1><p>Plan what to study on which day. Exams you've added as tasks show up in pink.</p></div>
      <div class="actions">
        <label class="toggle">From <input class="input" type="date" id="plan-start" value="${start}" style="width:auto"></label>
        <label class="toggle">to <input class="input" type="date" id="plan-end" value="${end}" style="width:auto"></label>
        <button class="btn btn-primary" data-action="plan-day" data-d="${today >= start && today <= end ? today : start}">${ic("plus", 15)} Plan study</button></div></div>
    ${summary ? `<div class="plan-summary">${summary}</div>` : ""}
    <div class="card" style="padding:0"><div class="plan-scroll"><div class="plan-grid">
      <div class="plan-head"><div></div>${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div>${d}</div>`).join("")}</div>
      ${rows}</div></div></div>
    <div class="legend"><span>Tip: add your exams as tasks of type <b>Exam</b> (e.g. “Network exam 16 jun 9u”) and they'll appear here automatically.</span></div>`;
}

function studyModal(b = {}) {
  const isNew = !b.id;
  modal(`<h2>${isNew ? "Plan study" : "Edit study block"}</h2>
    <form id="study-form">
      <div class="field-row">
        <div class="field"><label>Day</label><input class="input" type="date" name="date" required value="${esc(b.date)}"></div>
        <div class="field"><label>Course</label><input class="input" name="course" list="course-list2" value="${esc(b.course)}" placeholder="Pick a course">
          <datalist id="course-list2">${S.courses.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist></div></div>
      <div class="field"><label>What to study</label><input class="input" name="topic" value="${esc(b.topic)}" placeholder="e.g. Modules 4–7, revise, practice exam"></div>
      <label class="toggle"><input type="checkbox" name="done" ${b.done ? "checked" : ""}> Done</label>
      <div class="modal-actions">
        ${isNew ? "" : `<button type="button" class="btn btn-danger left" id="del-study">${ic("trash", 14)} Delete</button>`}
        <button type="button" class="btn btn-ghost" id="cancel">Cancel</button>
        <button class="btn btn-primary">${isNew ? "Add" : "Save"}</button></div>
    </form>`, (w) => {
    w.querySelector("#cancel").onclick = closeModal;
    if (isNew) setTimeout(() => w.querySelector("[name=course]").focus(), 50);
    w.querySelector("#del-study")?.addEventListener("click", async () => {
      if (!(await confirmDialog({ title: "Delete study block?", message: `“${b.course || "Study"}${b.topic ? ": " + b.topic : ""}” will be removed.`, confirmText: "Delete", danger: true }))) return;
      await S.store.deleteStudy(b.id); S.study = S.study.filter((x) => x.id !== b.id); render();
    });
    w.querySelector("#study-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = { date: f.get("date"), course: f.get("course").trim() || null, topic: f.get("topic").trim() || null, done: f.get("done") === "on" };
      closeModal();
      try {
        await ensureCourse(data.course);
        const row = await S.store.saveStudy(isNew ? data : { id: b.id, ...data });
        S.study = isNew ? [...S.study, row] : S.study.map((x) => (x.id === b.id ? row : x));
        render();
      } catch (er) { toast("Couldn't save: " + er.message); }
    };
  });
}

// ── Canvas tab ────────────────────────────────────────────────────
function guessCourse(canvasCourse) {
  if (!canvasCourse) return null;
  const cc = canvasCourse.toLowerCase();
  const hit = [...S.courses].sort((a, b) => b.name.length - a.name.length).find((c) => cc.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cc));
  return hit ? hit.name : canvasCourse;
}
function canvasDue(c) {
  if (!c.due_at) return { date: null, time: null };
  const d = new Date(c.due_at);
  return { date: ymd(d), time: c.all_day ? null : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}
function inDeadlines(c) { return c.task_id && S.tasks.some((t) => t.id === c.task_id) || S.tasks.some((t) => t.title.trim().toLowerCase() === c.title.trim().toLowerCase()); }
function cvRow(c, isNew) {
  const { date, time } = canvasDue(c);
  const u = date ? urgency({ due_date: date, status: "todo" }) : null;
  const added = inDeadlines(c);
  return `<div class="cv-item">${isNew ? `<span class="cv-new"></span>` : ""}
    <div class="body"><div class="title">${esc(c.title)}</div>
      <div class="meta">${c.course ? `<span class="chip chip-course"><span class="dot" style="background:${courseColor(guessCourse(c.course))}"></span>${esc(c.course)}</span>` : ""}
        ${date ? `<span>Due ${longDate(date)}${time ? " · " + time : ""}</span><span class="chip ${u.cls}">${u.label}</span>` : "<span>No due date</span>"}
        ${added ? `<span class="chip u-done">✓ In your deadlines</span>` : ""}
        ${isNew ? `<span>· appeared ${relLabel(ymd(new Date(c.first_seen))).toLowerCase()}</span>` : ""}</div></div>
    <div class="acts">
      ${c.url ? `<a class="btn btn-ghost btn-sm" href="${esc(c.url)}" target="_blank" rel="noopener">${ic("ext", 13)} Canvas</a>` : ""}
      ${added ? "" : `<button class="btn btn-primary btn-sm" data-action="cv-add" data-uid="${esc(c.uid)}">${ic("plus", 13)} Add to deadlines</button>`}
      ${isNew ? `<button class="btn btn-ghost btn-sm" data-action="cv-seen" data-uid="${esc(c.uid)}">${ic("check", 13)} Got it</button>` : ""}</div></div>`;
}
function viewCanvas() {
  const fresh = newCanvas().sort((a, b) => (b.first_seen || "").localeCompare(a.first_seen || ""));
  const now = new Date().toISOString();
  const upcoming = S.canvas.filter((c) => c.seen && (!c.due_at || c.due_at >= now)).sort((a, b) => (a.due_at || "9").localeCompare(b.due_at || "9"));
  const none = !S.canvas.length;
  return `<div class="page-head"><div><h1>New on Canvas</h1><p>New assignments from your Canvas calendar. Checked every hour; nothing is added to your deadlines unless you choose to.</p></div>
      ${fresh.length ? `<div class="actions"><button class="btn btn-ghost" data-action="cv-all-seen">${ic("check", 14)} Mark all as seen</button></div>` : ""}</div>
    ${none ? `<div class="card"><div class="empty">Nothing from Canvas yet.<br><br>The sync runs every hour once the <b>CANVAS_ICS_URL</b> secret is set on GitHub and <b>002_v2.sql</b> has been run in Supabase.<br>The first sync just reads what's already there; from then on, new assignments show up here.</div></div>` : `
    <div class="card" style="margin-bottom:18px"><div class="card-head"><h2>New ${fresh.length ? `<span class="chip chip-new" style="margin-left:6px">${fresh.length}</span>` : ""}</h2></div>
      <div class="list">${fresh.length ? fresh.map((c) => cvRow(c, true)).join("") : `<div class="empty">You're all caught up ✨</div>`}</div></div>
    <div class="card"><div class="card-head"><h2>Upcoming on Canvas <span class="sub">${upcoming.length}</span></h2></div>
      <div class="list scroll" style="max-height:520px">${upcoming.length ? upcoming.map((c) => cvRow(c, false)).join("") : `<div class="empty">No upcoming assignments.</div>`}</div></div>`}`;
}
async function markSeen(uids) {
  for (const u of uids) {
    const row = await S.store.updateCanvas(u, { seen: true });
    S.canvas = S.canvas.map((c) => (c.uid === u ? { ...c, ...row } : c));
  }
  render();
}

// ── All tasks view ────────────────────────────────────────────────
function viewTasks() {
  const f = S.filters, q = f.q.toLowerCase();
  const list = S.tasks.filter((t) =>
    (f.kind === "all" || t.kind === f.kind) && (!f.course || t.course === f.course) &&
    (f.showDone || t.status !== "done") && (!q || (t.title + " " + (t.course || "")).toLowerCase().includes(q))).sort(byDue);
  const mon = ymd(mondayOf(new Date())), sun = ymd(addDays(mondayOf(new Date()), 6)), nextSun = ymd(addDays(mondayOf(new Date()), 13)), today = ymd(new Date());
  const groups = [
    ["Overdue", (t) => t.due_date && t.due_date < today],
    ["This week", (t) => t.due_date && t.due_date >= today && t.due_date <= sun],
    ["Next week", (t) => t.due_date && t.due_date > sun && t.due_date <= nextSun],
    ["Later", (t) => t.due_date && t.due_date > nextSun],
    ["No date", (t) => !t.due_date],
  ];
  const active = list.filter((t) => t.status !== "done"), done = list.filter((t) => t.status === "done");
  let html = "";
  for (const [name, fn] of groups) {
    const g = active.filter(fn);
    if (g.length) html += `<div class="group-title">${name} <span class="count">${g.length}</span></div>${g.map((t) => taskRow(t, { showKind: true })).join("")}`;
  }
  if (done.length) html += `<div class="group-title">Done <span class="count">${done.length}</span></div>${done.map((t) => taskRow(t, { showKind: true })).join("")}`;
  const kinds = { all: "All", deadline: "Deadlines", exam: "Exams", todo: "To-dos" };
  return `<div class="page-head"><h1>All tasks</h1><button class="btn btn-primary" data-action="add">${ic("plus", 15)} New task</button></div>
    <div class="card">
      <div class="filters">
        <div class="tabs" style="margin:0">${Object.entries(kinds).map(([k, v]) => `<button class="tab ${f.kind === k ? "active" : ""}" data-action="filter-kind" data-k="${k}">${v}</button>`).join("")}</div>
        <select class="select" id="f-course"><option value="">All courses</option>${S.courses.map((c) => `<option ${f.course === c.name ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <input class="input" id="f-q" placeholder="Search…" value="${esc(f.q)}" style="max-width:220px">
        <label class="toggle"><input type="checkbox" id="f-done" ${f.showDone ? "checked" : ""}> Show completed</label>
      </div>
      <div class="list">${html || `<div class="empty">Nothing matches.</div>`}</div>
    </div>`;
}

// ── Courses view ──────────────────────────────────────────────────
function viewCourses() {
  return `<div class="page-head"><h1>Courses</h1><button class="btn btn-primary" data-action="edit-course">${ic("plus", 15)} Add course</button></div>
    <div class="courses-grid">${S.courses.map((c) => {
      const ts = open().filter((t) => t.course === c.name).sort(byDue);
      return `<div class="card course-card" style="--c:${c.color}">
        <div style="display:flex;justify-content:space-between;align-items:center"><h3>${esc(c.name)}</h3>
          <button class="icon-btn" data-action="edit-course" data-id="${c.id}" title="Edit">${ic("sliders", 14)}</button></div>
        <div style="color:var(--muted);font-size:13px">${ts.length} open · ${ts[0] ? `next: <b style="color:var(--text)">${esc(ts[0].title)}</b> (${relLabel(ts[0].due_date) || "no date"})` : "nothing due"}</div>
        <div class="links">
          ${c.canvas_url ? `<a class="btn btn-ghost btn-sm" href="${esc(c.canvas_url)}" target="_blank" rel="noopener">🎓 Canvas</a>` : ""}
          ${c.site_url ? `<a class="btn btn-ghost btn-sm" href="${esc(c.site_url)}" target="_blank" rel="noopener">🌐 Course site</a>` : ""}
          <button class="btn btn-ghost btn-sm" data-action="course-tasks" data-c="${esc(c.name)}">View tasks</button></div></div>`;
    }).join("")}</div>`;
}

// ── Modals ────────────────────────────────────────────────────────
function modal(html, onMount, cls = "") {
  closeModal();
  const w = document.createElement("div");
  w.className = "modal-wrap"; w.id = "modal"; w.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  w.addEventListener("mousedown", (e) => { if (e.target === w) closeModal(); });
  document.body.appendChild(w);
  onMount?.(w);
}
const closeModal = () => { const m = document.getElementById("modal"); if (m) { m._resolve?.(false); m.remove(); } };

function confirmDialog({ title, message = "", confirmText = "Confirm", danger = false }) {
  const prev = document.getElementById("modal");
  if (prev) prev.style.display = "none"; // keep an open editor underneath
  return new Promise((resolve) => {
    const w = document.createElement("div");
    w.className = "modal-wrap"; w.id = "confirm";
    w.innerHTML = `<div class="modal small"><h2>${esc(title)}</h2>${message ? `<p class="msg">${esc(message)}</p>` : ""}
      <div class="modal-actions"><button class="btn btn-ghost" data-r="0">Cancel</button>
      <button class="btn ${danger ? "btn-danger solid" : "btn-primary"}" data-r="1">${esc(confirmText)}</button></div></div>`;
    const done = (v) => { w.remove(); document.removeEventListener("keydown", key, true); if (prev) prev.style.display = ""; resolve(v); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } if (e.key === "Enter") { e.preventDefault(); done(true); } };
    w.addEventListener("mousedown", (e) => { if (e.target === w) done(false); });
    w.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => done(b.dataset.r === "1")));
    document.addEventListener("keydown", key, true);
    document.body.appendChild(w);
    w.querySelector('[data-r="1"]').focus();
  });
}

function taskModal(t = {}, { onSaved } = {}) {
  const isNew = !t.id;
  const v = { kind: "deadline", status: "todo", starred: false, ...t };
  modal(`<h2>${isNew ? "New task" : "Edit task"}</h2>
    <form id="task-form">
      <div class="field"><label>Type</label><div class="seg" id="kind-seg">${Object.entries(KIND).map(([k, o]) => `<button type="button" data-k="${k}" class="${v.kind === k ? "active" : ""}">${o.label}</button>`).join("")}</div></div>
      <div class="field"><label>Title</label><input class="input" name="title" required value="${esc(v.title)}" placeholder="What needs to be done?"></div>
      <div class="field"><label>Course</label><input class="input" name="course" list="course-list" value="${esc(v.course)}" placeholder="Pick or type a new one">
        <datalist id="course-list">${S.courses.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist></div>
      <div class="field-row">
        <div class="field"><label>Due date</label><input class="input" type="date" name="due_date" value="${esc(v.due_date)}"></div>
        <div class="field"><label>Time (optional)</label><input class="input" type="time" name="due_time" value="${esc(fmtTime(v.due_time))}"></div></div>
      <div class="field-row">
        <div class="field"><label>Status</label><select class="select" name="status">
          ${[["todo", "To do"], ["working", "In progress"], ["done", "Done"]].map(([k, l]) => `<option value="${k}" ${v.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label>Important</label><label class="toggle" style="height:40px"><input type="checkbox" name="starred" ${v.starred ? "checked" : ""}> ⭐ Mark as important</label></div></div>
      <div class="field"><label>Notes</label><textarea class="input" name="notes" rows="3" placeholder="Links, details, requirements…">${esc(v.notes)}</textarea></div>
      <div class="modal-actions">
        ${isNew ? "" : `<button type="button" class="btn btn-danger left" id="del-task">${ic("trash", 14)} Delete</button>`}
        <button type="button" class="btn btn-ghost" id="cancel">Cancel</button>
        <button class="btn btn-primary">${isNew ? "Add task" : "Save"}</button></div>
    </form>`, (w) => {
    let kind = v.kind;
    w.querySelectorAll("#kind-seg button").forEach((b) => (b.onclick = () => { kind = b.dataset.k; w.querySelectorAll("#kind-seg button").forEach((x) => x.classList.toggle("active", x === b)); }));
    w.querySelector("#cancel").onclick = closeModal;
    w.querySelector("#del-task")?.addEventListener("click", () => deleteTask(t.id));
    if (isNew) setTimeout(() => w.querySelector("[name=title]").focus(), 50);
    w.querySelector("#task-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        title: f.get("title").trim(), course: f.get("course").trim() || null, kind,
        due_date: f.get("due_date") || null, due_time: f.get("due_time") || null,
        status: f.get("status"), starred: f.get("starred") === "on", notes: f.get("notes").trim() || null,
      };
      if (!isNew && data.status === "done" && t.status !== "done" &&
        !(await confirmDialog({ title: "Mark as done?", message: `“${data.title}” will be marked as completed.`, confirmText: "Yes, it's done" }))) return;
      closeModal();
      if (isNew) { const row = await createTask(data); S.qa = ""; if (row) await onSaved?.(row); render(); }
      else await saveTask(t.id, data);
    };
  });
}

function courseModal(c = {}) {
  const isNew = !c.id;
  let color = c.color || PALETTE[S.courses.length % PALETTE.length];
  const isPreset = () => PALETTE.some((p) => p.toLowerCase() === color.toLowerCase());
  modal(`<h2>${isNew ? "New course" : "Edit course"}</h2>
    <form id="course-form">
      <div class="field"><label>Name</label><input class="input" name="name" required value="${esc(c.name)}" placeholder="e.g. Linux Web"></div>
      <div class="field"><label>Colour</label><div class="swatches">
        ${PALETTE.map((p) => `<button type="button" class="swatch" data-c="${p}" style="background:${p}" title="${p}"></button>`).join("")}
        <label class="color-custom" title="Pick any colour"><input type="color" id="color-any" value="${color.length === 7 ? color : "#3b9bff"}"></label>
        <span class="color-preview"><i></i><span></span></span></div></div>
      <div class="field"><label>Canvas link</label><input class="input" name="canvas_url" value="${esc(c.canvas_url)}" placeholder="https://thomasmore.instructure.com/courses/…"></div>
      <div class="field"><label>Course site (optional)</label><input class="input" name="site_url" value="${esc(c.site_url)}" placeholder="https://…"></div>
      <div class="modal-actions">
        ${isNew ? "" : `<button type="button" class="btn btn-danger left" id="del-course">${ic("trash", 14)} Delete</button>`}
        <button type="button" class="btn btn-ghost" id="cancel">Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>`, (w) => {
    const paint = () => {
      w.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("active", x.dataset.c.toLowerCase() === color.toLowerCase()));
      w.querySelector(".color-custom").classList.toggle("active", !isPreset());
      w.querySelector(".color-preview i").style.background = color;
      w.querySelector(".color-preview span").textContent = color.toUpperCase();
    };
    paint();
    w.querySelectorAll(".swatch").forEach((b) => (b.onclick = () => { color = b.dataset.c; paint(); }));
    w.querySelector("#color-any").oninput = (e) => { color = e.target.value; paint(); };
    w.querySelector("#cancel").onclick = closeModal;
    w.querySelector("#del-course")?.addEventListener("click", async () => {
      if (!(await confirmDialog({ title: `Delete “${c.name}”?`, message: "Its tasks stay, they just won't have a course colour anymore.", confirmText: "Delete course", danger: true }))) return;
      await S.store.deleteCourse(c.id); S.courses = S.courses.filter((x) => x.id !== c.id); closeModal(); render();
    });
    w.querySelector("#course-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const newName = f.get("name").trim();
      const saved = await S.store.saveCourse({ ...(isNew ? {} : { id: c.id }), name: newName, color, canvas_url: f.get("canvas_url").trim() || null, site_url: f.get("site_url").trim() || null, ...(isNew ? { sort: S.courses.length } : {}) });
      if (!isNew && c.name !== newName) {
        for (const t of S.tasks.filter((t) => t.course === c.name)) { await S.store.updateTask(t.id, { course: newName }); t.course = newName; }
        for (const b of S.study.filter((b) => b.course === c.name)) { await S.store.saveStudy({ ...b, course: newName }); b.course = newName; }
      }
      S.courses = isNew ? [...S.courses, saved] : S.courses.map((x) => (x.id === c.id ? { ...x, ...saved } : x));
      closeModal(); render();
    };
  });
}

function moreSheet() {
  const nNew = newCanvas().length;
  modal(`<h2>More</h2><div class="sheet-list">
    <button data-go="planner">${ic("planner", 20)} Exam planner</button>
    <button data-go="canvas">${ic("bell", 20)} New on Canvas ${nNew ? `<span class="badge">${nNew}</span>` : ""}</button>
    <button data-go="courses">${ic("book", 20)} Courses</button>
    <button data-go="theme">${ic(theme() === "dark" ? "sun" : "moon", 20)} ${theme() === "dark" ? "Light mode" : "Dark mode"}</button>
    ${S.store.mode === "cloud" ? `<button data-go="logout">${ic("logout", 20)} Sign out</button>` : ""}</div>`, (w) => {
    w.querySelectorAll("[data-go]").forEach((b) => (b.onclick = async () => {
      const g = b.dataset.go; closeModal();
      if (g === "theme") return toggleTheme();
      if (g === "logout") { await S.store.signOut(); return location.reload(); }
      S.view = g; localStorage.setItem("dd-view", g); render(); scrollTo(0, 0);
    }));
  }, "small");
}

// ── Actions ───────────────────────────────────────────────────────
async function ensureCourse(name) {
  if (!name || S.courses.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
  const c = await S.store.saveCourse({ name, color: PALETTE[S.courses.length % PALETTE.length], canvas_url: null, site_url: null, sort: S.courses.length });
  S.courses.push(c);
}
async function createTask(data) {
  try {
    await ensureCourse(data.course);
    const row = await S.store.addTask({ status: "todo", ...data });
    S.tasks.push(row);
    toast(`Added “${row.title}”${row.due_date ? ` · ${relLabel(row.due_date)}` : ""}`);
    render();
    return row;
  } catch (e) { toast("Couldn't save: " + e.message); }
}
async function saveTask(id, patch) {
  try {
    await ensureCourse(patch.course);
    const t = S.tasks.find((x) => x.id === id);
    if (patch.status === "done" && t.status !== "done") patch.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== "done") patch.completed_at = null;
    if (patch.due_date !== undefined && (patch.due_date !== t.due_date || (patch.due_time || null) !== (t.due_time ? fmtTime(t.due_time) : null))) patch.reminders_sent = [];
    Object.assign(t, await S.store.updateTask(id, patch));
    render();
  } catch (e) { toast("Couldn't save: " + e.message); }
}
async function deleteTask(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!(await confirmDialog({ title: "Delete this task?", message: `“${t.title}” will be removed.`, confirmText: "Delete", danger: true }))) return;
  closeModal();
  await S.store.deleteTask(id);
  S.tasks = S.tasks.filter((x) => x.id !== id);
  render();
  const { id: _, user_id, ...copy } = t;
  toast(`Deleted “${t.title}”`, "Undo", async () => { const row = await S.store.addTask(copy); S.tasks.push(row); render(); });
}
async function toggleDone(id) {
  const t = S.tasks.find((x) => x.id === id);
  const prev = t.status;
  if (prev !== "done" && !(await confirmDialog({ title: "Mark as done?", message: `“${t.title}” will be marked as completed.`, confirmText: "Yes, it's done" }))) return;
  await saveTask(id, { status: prev === "done" ? "todo" : "done" });
  if (prev !== "done") toast(`Nice! “${t.title}” done ✅`, "Undo", () => saveTask(id, { status: prev }));
}

function toast(msg, actionLabel, action) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ""}`;
  if (action) el.querySelector("button").onclick = () => { el.remove(); action(); };
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function tickClock() {
  const now = new Date();
  const t = document.getElementById("clock-time"), d = document.getElementById("clock-date");
  if (t) t.textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d) d.textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Event delegation ──────────────────────────────────────────────
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !root.contains(el)) return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a !== "block-toggle") e.stopPropagation();
  switch (a) {
    case "view": S.view = el.dataset.v; localStorage.setItem("dd-view", S.view); render(); scrollTo(0, 0); break;
    case "add": taskModal({ kind: el.dataset.kind || "deadline", due_date: el.dataset.date || null }); break;
    case "qa-more": { const p = quickParse(S.qa, S.courses); taskModal(S.qa.trim() ? p : {}); break; }
    case "edit": taskModal(S.tasks.find((t) => t.id === id)); break;
    case "toggle": toggleDone(id); break;
    case "star": { const t = S.tasks.find((x) => x.id === id); saveTask(id, { starred: !t.starred }); break; }
    case "cal": S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + +el.dataset.d, 1); render(); break;
    case "pick-day": S.selectedDay = el.dataset.d && el.dataset.d !== S.selectedDay ? el.dataset.d : null; render(); break;
    case "week": S.weekOffset = +el.dataset.d; S.selectedDay = null; render(); break;
    case "todo-tab": S.todoTab = el.dataset.t; render(); break;
    case "filter-kind": S.filters.kind = el.dataset.k; render(); break;
    case "course-tasks": S.filters = { ...S.filters, course: el.dataset.c, kind: "all" }; S.view = "tasks"; render(); break;
    case "edit-course": courseModal(S.courses.find((c) => c.id === id)); break;
    case "del-note": await S.store.deleteNote(id); S.notes = S.notes.filter((n) => n.id !== id); render(); break;
    case "bigcal": S.bigMonth = new Date(S.bigMonth.getFullYear(), S.bigMonth.getMonth() + +el.dataset.d, 1); S.bigSelected = null; render(); break;
    case "bigcal-today": S.bigMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); S.bigSelected = ymd(new Date()); render(); break;
    case "mday":
      if (isMobile()) { S.bigSelected = el.dataset.d === S.bigSelected ? null : el.dataset.d; render(); document.querySelector(".day-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else { S.bigSelected = el.dataset.d; render(); taskModal({ kind: "deadline", due_date: el.dataset.d }); }
      break;
    case "plan-day": studyModal({ date: el.dataset.d }); break;
    case "block": studyModal(S.study.find((b) => b.id === id)); break;
    case "block-toggle": {
      const b = S.study.find((x) => x.id === id);
      const row = await S.store.saveStudy({ ...b, done: el.checked });
      S.study = S.study.map((x) => (x.id === id ? row : x)); render(); break;
    }
    case "cv-seen": markSeen([el.dataset.uid]); break;
    case "cv-all-seen": markSeen(newCanvas().map((c) => c.uid)); break;
    case "cv-add": {
      const c = S.canvas.find((x) => x.uid === el.dataset.uid), { date, time } = canvasDue(c);
      taskModal({ kind: /exam|examen|test|toets/i.test(c.title) ? "exam" : "deadline", title: c.title, course: guessCourse(c.course), due_date: date, due_time: time, notes: c.url || null }, {
        onSaved: async (row) => { const u = await S.store.updateCanvas(c.uid, { seen: true, task_id: row.id }); S.canvas = S.canvas.map((x) => (x.uid === c.uid ? { ...x, ...u } : x)); },
      });
      break;
    }
    case "wx-refresh": S.wx = null; paintWeather(); loadWeather(true); break;
    case "theme": toggleTheme(); break;
    case "more": moreSheet(); break;
    case "logout": await S.store.signOut(); location.reload(); break;
    case "reset-demo":
      if (await confirmDialog({ title: "Reset demo data?", message: "This puts the demo back to your imported Excel data.", confirmText: "Reset", danger: true })) { S.store.resetDemo(); location.reload(); }
      break;
  }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "note-form") return;
  e.preventDefault();
  const text = new FormData(e.target).get("text").trim();
  if (!text) return;
  S.notes.push(await S.store.addNote(text)); render();
  document.querySelector("#note-form input")?.focus();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "f-q") { S.filters.q = e.target.value; const pos = e.target.selectionStart; render(); const i = document.getElementById("f-q"); i.focus(); i.setSelectionRange(pos, pos); }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "f-course") { S.filters.course = e.target.value; render(); }
  if (e.target.id === "f-done") { S.filters.showDone = e.target.checked; render(); }
  if (e.target.id === "plan-start" || e.target.id === "plan-end") {
    const key = e.target.id === "plan-start" ? "exam_start" : "exam_end";
    if (!e.target.value) return;
    S.settings[key] = e.target.value;
    try { await S.store.setSetting(key, e.target.value); } catch (er) { toast("Couldn't save: " + er.message); }
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (document.getElementById("confirm")) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "n" && !e.target.closest("input, textarea, select") && !document.getElementById("modal")) { e.preventDefault(); const qa = document.getElementById("qa"); qa ? qa.focus() : taskModal(); }
});
let lastMobile = isMobile();
addEventListener("resize", () => { if (isMobile() !== lastMobile) { lastMobile = isMobile(); if (S.store) render(); } });

boot();
