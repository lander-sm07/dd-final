// Reads your Canvas calendar feed and stores the assignments in Supabase (table canvas_items),
// so the "New on Canvas" tab can show what's new. It never adds deadlines and never sends Discord messages.
// GitHub runs this every hour, right after the reminders (see .github/workflows/reminders.yml).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, CANVAS_ICS_URL. Optional: DRY_RUN=1, ICS_FILE=path (testing)

import { readFile } from "node:fs/promises";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, CANVAS_ICS_URL, DRY_RUN, ICS_FILE } = process.env;
const TZ = "Europe/Brussels";
if (!CANVAS_ICS_URL && !ICS_FILE) { console.log("No CANVAS_ICS_URL secret set, skipping the Canvas sync."); process.exit(0); }
if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) { console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY."); process.exit(1); }

// ── ICS parsing ──
export function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(";");
    cur[name.toUpperCase()] = { val: line.slice(i + 1), params: Object.fromEntries(params.map((p) => p.split("="))) };
  }
  return events;
}
const unescape = (s = "") => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t) => { const s = new Date(t).toLocaleString("en-US", { timeZone: tz, hourCycle: "h23" }); return Date.parse(s + " UTC") - t; };
  return new Date(guess - offset(guess - offset(guess)));
}
function parseDate(prop) {
  if (!prop) return { due_at: null, all_day: false };
  const v = prop.val, m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { due_at: null, all_day: false };
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { due_at: new Date(Date.UTC(+y, +mo - 1, +d, 12)).toISOString(), all_day: true }; // noon UTC keeps the date stable
  if (z) return { due_at: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)).toISOString(), all_day: false };
  return { due_at: zonedToUtc(+y, +mo, +d, +h, +mi, prop.params.TZID || TZ).toISOString(), all_day: false };
}
export function toItem(ev, host) {
  const uid = ev.UID?.val;
  if (!uid || !/assignment/i.test(uid)) return null; // only assignments, not lectures/calendar events
  let title = unescape(ev.SUMMARY?.val), course = null;
  const m = title.match(/^(.*)\s\[([^\]]+)\]$/);
  if (m) { title = m[1].trim(); course = m[2].trim(); }
  let url = ev.URL ? unescape(ev.URL.val) : null;
  const ctx = url?.match(/include_contexts=course_(\d+)/), asg = url?.match(/#assignment_(\d+)/) || uid.match(/assignment-(\d+)/);
  if (ctx && asg && host) url = `${host}/courses/${ctx[1]}/assignments/${asg[1]}`;
  return { uid, title, course, url, ...parseDate(ev.DTSTART || ev.DUE) };
}

// ── Supabase ──
const headers = SUPABASE_SERVICE_KEY ? { apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json", ...(SUPABASE_SERVICE_KEY.startsWith("sb_") ? {} : { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` }) } : {};
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.status === 204 || r.status === 201 ? null : r.json().catch(() => null);
}

// ── main ──
const text = ICS_FILE ? await readFile(ICS_FILE, "utf8") : await (async () => {
  const r = await fetch(CANVAS_ICS_URL);
  if (!r.ok) throw new Error(`Canvas feed ${r.status}`);
  return r.text();
})();
const host = CANVAS_ICS_URL ? new URL(CANVAS_ICS_URL).origin : "https://thomasmore.instructure.com";
const cutoff = Date.now() - 30 * 864e5; // ignore assignments that were due over a month ago
const items = parseICS(text).map((e) => toItem(e, host)).filter((x) => x && (!x.due_at || Date.parse(x.due_at) >= cutoff));
const unique = [...new Map(items.map((x) => [x.uid, x])).values()];

if (DRY_RUN) { console.log(JSON.stringify(unique.slice(0, 5), null, 2)); console.log(`${unique.length} assignments parsed (dry run)`); process.exit(0); }

const existing = await sb("canvas_items?select=uid&limit=1");
const firstRun = !existing?.length; // first sync: everything already on Canvas counts as "seen", only later ones are "new"
const now = new Date().toISOString();
const rows = unique.map((x) => ({ ...x, updated_at: now, ...(firstRun ? { seen: true } : {}) }));
for (let i = 0; i < rows.length; i += 200) {
  await sb("canvas_items?on_conflict=uid", { method: "POST", body: JSON.stringify(rows.slice(i, i + 200)), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
}
console.log(`Canvas: ${rows.length} assignments synced${firstRun ? " (first run: all marked as seen)" : ""}.`);
