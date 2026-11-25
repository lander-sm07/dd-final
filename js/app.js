import { CONFIG } from "./config.js";
import { createStore } from "./store.js";
import { ymd, parseYmd, addDays, startOfDay, daysUntil, urgency, relLabel, fmtShort, fmtTime, quickParse } from "./dates.js";

// ── Icons ─────────────────────────────────────────────────────────
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
};
const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PALETTE = ["#6CC4FF", "#7C9CFF", "#4FD1C5", "#F6AD55", "#F687B3", "#9AE6B4", "#B794F4", "#FC8181", "#63B3ED", "#FBD38D"];
const KIND = { deadline: { label: "Deadline", icon: "doc" }, exam: { label: "Exam", icon: "cap" }, todo: { label: "To-do", icon: "todo" } };
const QUOTES = ["Keep going, you're doing great. 💙", "Small steps every day.", "Done is better than perfect.", "Future you says thanks.", "One task at a time."];

// ── State ─────────────────────────────────────────────────────────
const S = {
  store: null, tasks: [], courses: [], notes: [],
  view: localStorage.getItem("dd-view") || "dashboard",
  calMonth: startOfDay(new Date()), selectedDay: null, todoTab: "open",
  filters: { kind: "all", course: "", showDone: false, q: "" },
  qa: "",
};
const root = document.getElementById("root");
const courseColor = (name) => S.courses.find((c) => c.name === name)?.color || "#8796b6";
const byDue = (a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || (a.due_time || "99").localeCompare(b.due_time || "99");
const open = () => S.tasks.filter((t) => t.status !== "done");

// ── Boot ──────────────────────────────────────────────────────────
async function boot() {
  try {
    S.store = await createStore();
    const session = await S.store.session();
    if (!session) return renderLogin();
    await loadAll();
    render();
    setInterval(tickClock, 1000);
    let lastDay = ymd(new Date());
    setInterval(() => { if (ymd(new Date()) !== lastDay) { lastDay = ymd(new Date()); render(); } }, 60000);
    // refresh when you come back to the tab (e.g. added something on your phone)
    document.addEventListener("visibilitychange", async () => { if (!document.hidden && S.store.mode === "cloud") { await loadAll(); render(); } });
  } catch (e) {
    root.innerHTML = `<div class="login"><div class="card"><h1>Something went wrong</h1><p class="error">${esc(e.message)}</p><p>Check the values in js/config.js.</p></div></div>`;
    console.error(e);
  }
}
async function loadAll() {
  [S.tasks, S.courses, S.notes] = await Promise.all([S.store.getTasks(), S.store.getCourses(), S.store.getNotes()]);
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
function render() {
  const nav = (v, icon, tip) => `<button class="nav-btn ${S.view === v ? "active" : ""}" data-action="view" data-v="${v}" data-tip="${tip}">${ic(icon, 20)}</button>`;
  root.innerHTML = `<div class="app">
    <aside class="sidebar">
      <div class="logo">${ic("check", 22)}</div>
      ${nav("dashboard", "home", "Dashboard")}${nav("tasks", "list", "All tasks")}${nav("courses", "book", "Courses")}
      <div class="spacer"></div>
      <button class="nav-btn" data-action="add" data-tip="New task">${ic("plus", 20)}</button>
      ${S.store.mode === "cloud" ? `<button class="nav-btn" data-action="logout" data-tip="Sign out">${ic("logout", 20)}</button>` : ""}
    </aside>
    <main class="main">${S.store.mode === "demo" ? demoBanner() : ""}${{ dashboard: viewDashboard, tasks: viewTasks, courses: viewCourses }[S.view]()}</main>
  </div>
  <nav class="mobile-nav">
    ${nav("dashboard", "home", "")}${nav("tasks", "list", "")}
    <button class="fab" data-action="add">${ic("plus", 24)}</button>
    ${nav("courses", "book", "")}
    ${S.store.mode === "cloud" ? `<button class="nav-btn" data-action="logout">${ic("logout", 20)}</button>` : `<span style="width:46px"></span>`}
  </nav>`;
  bindQuickAdd();
  tickClock();
  paintTimer();
}

const demoBanner = () => `<div class="demo-banner">✨ Demo mode: your data is saved in this browser only. Connect Supabase (see the setup guide) to sync with your phone.
  <button class="btn btn-ghost btn-sm" data-action="reset-demo">Reset demo data</button></div>`;

// ── Dashboard ─────────────────────────────────────────────────────
function viewDashboard() {
  const h = new Date().getHours();
  const greet = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `
  <header class="header">
    <div class="greet"><h1>${greet}${CONFIG.NAME ? `,<br><span class="name">${esc(CONFIG.NAME)}</span>` : ""} 👋</h1><p>${esc(CONFIG.TAGLINE)}</p></div>
    <div class="clock"><div class="time" id="clock-time"></div><div class="date" id="clock-date"></div></div>
  </header>
  ${quickAddBar()}
  <div class="grid">
    <section class="card span-4 o-cal">${calendarCard()}</section>
    <section class="card span-4 o-agenda">${agendaCard()}</section>
    <section class="card span-4 nextup-card o-next">${nextUpCard()}</section>
    <section class="card span-7 o-todo">${todoCard()}</section>
    <section class="card span-5 o-timer">${timerCard()}</section>
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
  const start = addDays(first, -((first.getDay() + 6) % 7)); // Monday first
  const today = ymd(new Date());
  const byDay = {};
  for (const t of open()) if (t.due_date) (byDay[t.due_date] ||= []).push(t);
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), k = ymd(d), items = byDay[k] || [];
    if (i === 35 && d.getMonth() !== m.getMonth()) break;
    const marks = items.slice(0, 3).map((t) => `<i style="background:${t.kind === "exam" ? "#ff8fb1" : courseColor(t.course)}"></i>`).join("");
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
  const d = parseYmd(t.due_date);
  return `<div class="agenda-item" style="--c:${courseColor(t.course)}" data-action="edit" data-id="${t.id}">
    <div class="when"><b>${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()}</b>${t.due_time ? fmtTime(t.due_time) : KIND[t.kind].label}</div>
    <div class="what"><div>${esc(t.title)}</div><small>${esc(t.course || "No course")}${t.status === "working" ? " · in progress" : ""}</small></div></div>`;
}
function agendaCard() {
  let items, title, sub;
  if (S.selectedDay) {
    items = open().filter((t) => t.due_date === S.selectedDay).sort(byDue);
    title = parseYmd(S.selectedDay).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
    sub = `<button class="btn btn-ghost btn-sm" data-action="pick-day" data-d="">Back to week</button>`;
  } else {
    const end = ymd(addDays(new Date(), 7));
    items = open().filter((t) => t.due_date && t.due_date <= end).sort(byDue);
    title = "Next 7 days"; sub = `<span class="sub">${items.length} item${items.length === 1 ? "" : "s"}</span>`;
  }
  return `<div class="card-head"><h2>${title}</h2>${sub}</div>
    <div class="agenda">${items.length ? items.map(agendaItem).join("") : `<div class="empty">Nothing due${S.selectedDay ? " this day" : " this week"} 🎉</div>`}</div>`;
}

function nextUpCard() {
  const next = open().filter((t) => t.due_date && t.kind !== "todo" && daysUntil(t.due_date) >= 0).sort(byDue)[0];
  const weekEnd = ymd(addDays(new Date(), 7)), weekAgo = addDays(new Date(), -7).toISOString();
  const dueWeek = open().filter((t) => t.due_date && t.due_date <= weekEnd).length;
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
        <span>${KIND[next.kind].label} · ${parseYmd(next.due_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${next.due_time ? " · " + fmtTime(next.due_time) : ""}</span></div></div>`;
  }
  return `<div class="nextup"><div class="card-head"><h2>Next up</h2></div>${body}
    <div class="stats"><div class="stat"><b>${dueWeek}</b><span>this week</span></div>
    <div class="stat"><b style="color:${overdue ? "var(--danger)" : "inherit"}">${overdue}</b><span>overdue</span></div>
    <div class="stat"><b style="color:var(--ok)">${doneWeek}</b><span>done (7d)</span></div></div></div>`;
}

function taskRow(t, { showKind = false } = {}) {
  const u = urgency(t);
  const kindIco = showKind ? `<span class="kind-ico" style="background:${t.kind === "exam" ? "#ff8fb1" : courseColor(t.course)}">${ic(KIND[t.kind].icon, 17)}</span>` : "";
  return `<div class="row ${t.status === "done" ? "is-done" : ""}" data-action="edit" data-id="${t.id}">
    <button class="check ${t.status}" data-action="toggle" data-id="${t.id}" title="Mark done">${ic("check", 12)}</button>
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
  return `<div class="card-head"><h2>Upcoming deadlines <span class="sub">${open().filter((t) => t.kind !== "todo").length} open</span></h2>
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

// ── Focus timer ───────────────────────────────────────────────────
const T = { mode: "focus", len: { focus: 25 * 60, break: 5 * 60 }, remaining: 25 * 60, running: false, endAt: 0, iv: null };
const sessKey = () => "dd-sessions-" + ymd(new Date());
function timerCard() {
  return `<div class="card-head"><h2>Focus timer</h2>
      <div class="tabs" style="margin:0"><button class="tab ${T.mode === "focus" ? "active" : ""}" data-action="timer-mode" data-m="focus">Focus</button><button class="tab ${T.mode === "break" ? "active" : ""}" data-action="timer-mode" data-m="break">Break</button></div></div>
    <div class="timer"><div class="timer-ring"><svg viewBox="0 0 200 200">
        <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cc4ff"/><stop offset="1" stop-color="#3d8bff"/></linearGradient></defs>
        <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="10"/>
        <circle id="timer-arc" cx="100" cy="100" r="88" fill="none" stroke="url(#tg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="0"/></svg>
      <div class="t"><b id="timer-text">25:00</b><span>${T.mode === "focus" ? "Focus" : "Break"}</span></div></div>
      <div class="timer-controls"><span style="width:30px"></span>
        <button class="play" data-action="timer-toggle" id="timer-btn">${ic(T.running ? "pause" : "play", 22)}</button>
        <button class="icon-btn" data-action="timer-reset" title="Reset">${ic("reset", 15)}</button></div>
      <div class="sessions">🔥 ${+localStorage.getItem(sessKey()) || 0} focus session(s) today</div></div>`;
}
function paintTimer() {
  if (T.running) T.remaining = Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
  const txt = document.getElementById("timer-text"), arc = document.getElementById("timer-arc");
  if (txt) txt.textContent = `${String(Math.floor(T.remaining / 60)).padStart(2, "0")}:${String(T.remaining % 60).padStart(2, "0")}`;
  if (arc) arc.setAttribute("stroke-dashoffset", String(553 * (1 - T.remaining / T.len[T.mode])));
  if (T.running && T.remaining === 0) timerDone();
}
function timerDone() {
  clearInterval(T.iv); T.running = false;
  if (T.mode === "focus") localStorage.setItem(sessKey(), (+localStorage.getItem(sessKey()) || 0) + 1);
  beep();
  toast(T.mode === "focus" ? "Focus session done. Take a break! ☕" : "Break's over. Back to it! 💪");
  T.mode = T.mode === "focus" ? "break" : "focus"; T.remaining = T.len[T.mode];
  render();
}
function beep() {
  try { const a = new AudioContext(); [0, .25, .5].forEach((d) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.15, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d + .2); o.connect(g).connect(a.destination); o.start(a.currentTime + d); o.stop(a.currentTime + d + .2); }); } catch {}
}

// ── All tasks view ────────────────────────────────────────────────
function viewTasks() {
  const f = S.filters, q = f.q.toLowerCase();
  const list = S.tasks.filter((t) =>
    (f.kind === "all" || t.kind === f.kind) && (!f.course || t.course === f.course) &&
    (f.showDone || t.status !== "done") && (!q || (t.title + " " + (t.course || "")).toLowerCase().includes(q))).sort(byDue);
  const groups = [["Overdue", (d) => d < 0], ["This week", (d) => d >= 0 && d <= 7], ["Next week", (d) => d > 7 && d <= 14], ["Later", (d) => d > 14], ["No date", (d) => d === null]];
  const active = list.filter((t) => t.status !== "done"), done = list.filter((t) => t.status === "done");
  let html = "";
  for (const [name, fn] of groups) {
    const g = active.filter((t) => fn(daysUntil(t.due_date)));
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
function modal(html, onMount) {
  closeModal();
  const w = document.createElement("div");
  w.className = "modal-wrap"; w.id = "modal"; w.innerHTML = `<div class="modal">${html}</div>`;
  w.addEventListener("mousedown", (e) => { if (e.target === w) closeModal(); });
  document.body.appendChild(w);
  onMount?.(w);
}
const closeModal = () => document.getElementById("modal")?.remove();

function taskModal(t = {}) {
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
      closeModal();
      if (isNew) { await createTask(data); S.qa = ""; render(); }
      else await saveTask(t.id, data);
    };
  });
}

function courseModal(c = {}) {
  const isNew = !c.id;
  let color = c.color || PALETTE[S.courses.length % PALETTE.length];
  modal(`<h2>${isNew ? "New course" : "Edit course"}</h2>
    <form id="course-form">
      <div class="field"><label>Name</label><input class="input" name="name" required value="${esc(c.name)}" placeholder="e.g. Linux Web"></div>
      <div class="field"><label>Colour</label><div class="swatches">${PALETTE.map((p) => `<button type="button" class="swatch ${p === color ? "active" : ""}" data-c="${p}" style="background:${p}"></button>`).join("")}</div></div>
      <div class="field"><label>Canvas link</label><input class="input" name="canvas_url" value="${esc(c.canvas_url)}" placeholder="https://thomasmore.instructure.com/courses/…"></div>
      <div class="field"><label>Course site (optional)</label><input class="input" name="site_url" value="${esc(c.site_url)}" placeholder="https://…"></div>
      <div class="modal-actions">
        ${isNew ? "" : `<button type="button" class="btn btn-danger left" id="del-course">${ic("trash", 14)} Delete</button>`}
        <button type="button" class="btn btn-ghost" id="cancel">Cancel</button><button class="btn btn-primary">Save</button></div>
    </form>`, (w) => {
    w.querySelectorAll(".swatch").forEach((b) => (b.onclick = () => { color = b.dataset.c; w.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("active", x === b)); }));
    w.querySelector("#cancel").onclick = closeModal;
    w.querySelector("#del-course")?.addEventListener("click", async () => {
      if (!confirm(`Delete course “${c.name}”? Its tasks stay, they just won't have a course colour.`)) return;
      await S.store.deleteCourse(c.id); S.courses = S.courses.filter((x) => x.id !== c.id); closeModal(); render();
    });
    w.querySelector("#course-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const newName = f.get("name").trim();
      const saved = await S.store.saveCourse({ ...(isNew ? {} : { id: c.id }), name: newName, color, canvas_url: f.get("canvas_url").trim() || null, site_url: f.get("site_url").trim() || null, ...(isNew ? { sort: S.courses.length } : {}) });
      if (!isNew && c.name !== newName) { // rename: move tasks along
        for (const t of S.tasks.filter((t) => t.course === c.name)) { await S.store.updateTask(t.id, { course: newName }); t.course = newName; }
      }
      S.courses = isNew ? [...S.courses, saved] : S.courses.map((x) => (x.id === c.id ? { ...x, ...saved } : x));
      closeModal(); render();
    };
  });
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
  } catch (e) { toast("Couldn't save: " + e.message); }
}
async function saveTask(id, patch) {
  try {
    await ensureCourse(patch.course);
    const t = S.tasks.find((x) => x.id === id);
    if (patch.status === "done" && t.status !== "done") patch.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== "done") patch.completed_at = null;
    if (patch.due_date !== undefined && (patch.due_date !== t.due_date || patch.due_time !== t.due_time)) patch.reminders_sent = []; // new date → fresh reminders
    Object.assign(t, await S.store.updateTask(id, patch));
    render();
  } catch (e) { toast("Couldn't save: " + e.message); }
}
async function deleteTask(id) {
  const t = S.tasks.find((x) => x.id === id);
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
  if (["toggle", "star", "del-note", "edit-course"].includes(a)) e.stopPropagation();
  switch (a) {
    case "view": S.view = el.dataset.v; localStorage.setItem("dd-view", S.view); render(); scrollTo(0, 0); break;
    case "add": taskModal({ kind: el.dataset.kind || "deadline" }); break;
    case "qa-more": { const p = quickParse(S.qa, S.courses); taskModal(S.qa.trim() ? p : {}); break; }
    case "edit": if (!e.target.closest(".check, .star")) taskModal(S.tasks.find((t) => t.id === id)); break;
    case "toggle": toggleDone(id); break;
    case "star": { const t = S.tasks.find((x) => x.id === id); saveTask(id, { starred: !t.starred }); break; }
    case "cal": S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + +el.dataset.d, 1); render(); break;
    case "pick-day": S.selectedDay = el.dataset.d && el.dataset.d !== S.selectedDay ? el.dataset.d : null; render(); break;
    case "todo-tab": S.todoTab = el.dataset.t; render(); break;
    case "filter-kind": S.filters.kind = el.dataset.k; render(); break;
    case "course-tasks": S.filters = { ...S.filters, course: el.dataset.c, kind: "all" }; S.view = "tasks"; render(); break;
    case "edit-course": courseModal(S.courses.find((c) => c.id === id)); break;
    case "del-note": await S.store.deleteNote(id); S.notes = S.notes.filter((n) => n.id !== id); render(); break;
    case "timer-toggle":
      if (T.running) { T.running = false; clearInterval(T.iv); paintTimer(); }
      else { T.running = true; T.endAt = Date.now() + T.remaining * 1000; T.iv = setInterval(paintTimer, 250); }
      el.innerHTML = ic(T.running ? "pause" : "play", 22); break;
    case "timer-reset": T.running = false; clearInterval(T.iv); T.remaining = T.len[T.mode]; render(); break;
    case "timer-mode": T.running = false; clearInterval(T.iv); T.mode = el.dataset.m; T.remaining = T.len[T.mode]; render(); break;
    case "logout": await S.store.signOut(); location.reload(); break;
    case "reset-demo": if (confirm("Reset the demo back to your imported Excel data?")) { S.store.resetDemo(); location.reload(); } break;
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
document.addEventListener("change", (e) => {
  if (e.target.id === "f-course") { S.filters.course = e.target.value; render(); }
  if (e.target.id === "f-done") { S.filters.showDone = e.target.checked; render(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "n" && !e.target.closest("input, textarea, select") && !document.getElementById("modal")) { e.preventDefault(); const qa = document.getElementById("qa"); qa ? qa.focus() : taskModal(); }
});

boot();
