// Sends your Discord reminders. GitHub runs this every hour (see .github/workflows/reminders.yml).
//
//   ☀️ 08:00  Morning overview: overdue, today, tomorrow, next 3 days, exams in the next 7 days
//   🌙 19:00  Heads-up for everything due tomorrow
//   ⏰ 3 hours before a deadline (deadlines without a time count as 23:59)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, DISCORD_WEBHOOK_URL
// Optional: DISCORD_USER_ID (to @mention you), DASHBOARD_URL, DRY_RUN=1 (print instead of send),
//           FORCE_DIGEST=true (send the morning overview right now, for testing)

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, DISCORD_WEBHOOK_URL, DISCORD_USER_ID, DASHBOARD_URL, DRY_RUN } = process.env;
const TZ = "Europe/Brussels";
const MORNING = [8, 12];   // send the overview between these hours (GitHub cron can run a bit late)
const EVENING = [19, 23];
const FINAL_CALL_HOURS = 3;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || (!DISCORD_WEBHOOK_URL && !DRY_RUN)) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or DISCORD_WEBHOOK_URL secrets.");
  process.exit(1);
}

// ── time helpers (always Brussels time, whatever the server's timezone) ──
function parts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
}
function zonedToUtc(ymd, hm) {
  const [y, m, d] = ymd.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const offset = (t) => { const s = new Date(t).toLocaleString("en-US", { timeZone: TZ, hourCycle: "h23" }); return Date.parse(s + " UTC") - t; };
  return new Date(guess - offset(guess - offset(guess)));
}
const addDaysYmd = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 864e5);
const nice = (ymd) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// ── Supabase REST ──
const headers = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" };
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...headers, ...opts.headers }, ...opts });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
async function markSent(task, key) {
  task.reminders_sent = [...(task.reminders_sent || []), key];
  if (DRY_RUN) return;
  await sb(`tasks?id=eq.${task.id}`, { method: "PATCH", body: JSON.stringify({ reminders_sent: task.reminders_sent }), headers: { Prefer: "return=minimal" } });
}
async function getMeta(key) { const r = await sb(`meta?key=eq.${key}&select=value`); return r?.[0]?.value ?? null; }
async function setMeta(key, value) {
  if (DRY_RUN) return;
  await sb("meta", { method: "POST", body: JSON.stringify({ key, value }), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
}

// ── Discord ──
async function discord(content, embeds) {
  const body = { username: "Deadlines", content: [DISCORD_USER_ID ? `<@${DISCORD_USER_ID}>` : "", content].filter(Boolean).join(" "), embeds, allowed_mentions: { users: DISCORD_USER_ID ? [DISCORD_USER_ID] : [] } };
  if (DRY_RUN) { console.log(JSON.stringify(body, null, 2)); return; }
  const r = await fetch(DISCORD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Discord ${r.status}: ${await r.text()}`);
}
const COLORS = { overdue: 0xff6b81, today: 0xff8e7a, soon: 0xffad5c, info: 0x6cc4ff, ok: 0x4fd1a5 };
const icon = (t) => (t.kind === "exam" ? "🎓" : t.kind === "todo" ? "☑️" : "📄");
const line = (t, showDate) => `${icon(t)} **${t.title}**${t.course ? ` · ${t.course}` : ""}${showDate ? ` · ${nice(t.due_date)}` : ""}${t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}${t.status === "working" ? " · _in progress_" : ""}`;
const section = (name, list, color, showDate = false) => list.length ? [{ title: name, description: list.map((t) => line(t, showDate)).join("\n").slice(0, 4000), color }] : [];

// ── main ──
const now = process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date(); // FAKE_NOW is for testing
const { ymd: today, hour } = parts(now);
const tomorrow = addDaysYmd(today, 1);
const tasks = (await sb("tasks?status=neq.done&due_date=not.is.null&select=*&order=due_date.asc,due_time.asc.nullslast")) || [];
const byDue = (a, b) => (a.due_date + (a.due_time || "23:59")).localeCompare(b.due_date + (b.due_time || "23:59"));
tasks.sort(byDue);
let sent = 0;

// 1. Morning overview
const FORCE = process.env.FORCE_DIGEST === "true";
if (FORCE || (hour >= MORNING[0] && hour < MORNING[1] && (await getMeta("last_digest")) !== today)) {
  const d = (t) => dayDiff(t.due_date, today);
  const overdue = tasks.filter((t) => d(t) < 0 && d(t) >= -14);
  const dueToday = tasks.filter((t) => d(t) === 0);
  const dueTomorrow = tasks.filter((t) => d(t) === 1);
  const soon = tasks.filter((t) => d(t) >= 2 && d(t) <= 3);
  const exams = tasks.filter((t) => t.kind === "exam" && d(t) >= 4 && d(t) <= 7);
  const embeds = [
    ...section("⚠️ Overdue", overdue, COLORS.overdue, true),
    ...section("📌 Due today", dueToday, COLORS.today),
    ...section("⏭️ Due tomorrow", dueTomorrow, COLORS.soon),
    ...section("🗓️ Next few days", soon, COLORS.info, true),
    ...section("🎓 Exams this week", exams, COLORS.info, true),
  ];
  const weekday = new Date(today + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  if (!embeds.length) embeds.push({ description: "Nothing due in the next few days. Enjoy it! 🎉", color: COLORS.ok });
  if (DASHBOARD_URL) embeds[embeds.length - 1].footer = { text: "Open your dashboard: " + DASHBOARD_URL };
  await discord(`☀️ **Good morning! Here's your ${weekday}.**`, embeds);
  if (!FORCE) await setMeta("last_digest", today);
  sent++;
}

// 2. Evening heads-up for tomorrow
if (hour >= EVENING[0] && hour < EVENING[1]) {
  const list = tasks.filter((t) => t.due_date === tomorrow && !(t.reminders_sent || []).includes("eve"));
  if (list.length) {
    await discord(`🌙 **Heads-up: ${list.length === 1 ? "this is" : "these are"} due tomorrow**`, section(nice(tomorrow), list, COLORS.soon));
    for (const t of list) await markSent(t, "eve");
    sent++;
  }
}

// 3. Final call, 3 hours before
const finalCall = tasks.filter((t) => {
  if ((t.reminders_sent || []).includes("3h")) return false;
  if (t.kind === "todo" && !t.due_time) return false;
  const hoursLeft = (zonedToUtc(t.due_date, (t.due_time || "23:59").slice(0, 5)) - now) / 36e5;
  t._hoursLeft = hoursLeft;
  return hoursLeft > 0 && hoursLeft <= FINAL_CALL_HOURS;
});
for (const t of finalCall) {
  const h = t._hoursLeft, left = h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${Math.round(h)}h`;
  await discord(`⏰ **Due in ${left}!**`, [{ description: line(t, false) + (t.notes ? `\n\n${t.notes.slice(0, 500)}` : ""), color: COLORS.today }]);
  await markSent(t, "3h");
  sent++;
}

console.log(`Brussels ${today} ${hour}h · ${tasks.length} open tasks · ${sent} message(s) sent`);
