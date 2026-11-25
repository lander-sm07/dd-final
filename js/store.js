// Data layer. Two interchangeable backends with the same methods:
//   LocalStore    → demo mode, saves in this browser (localStorage)
//   SupabaseStore → your real online database, synced across devices
import { CONFIG } from "./config.js";
import { SEED_TASKS, SEED_COURSES } from "./seed.js";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

class LocalStore {
  mode = "demo";
  key = "dd-demo-v1";
  constructor() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(this.key)); } catch {}
    if (!data) {
      const now = new Date().toISOString();
      data = {
        tasks: SEED_TASKS.map((t) => ({ id: uid(), due_time: null, starred: false, notes: null, created_at: now, ...t })),
        courses: SEED_COURSES.map((c) => ({ id: uid(), ...c })),
        notes: [
          { id: uid(), text: "Ask about the ethical committee date", created_at: now },
          { id: uid(), text: "Print Hostingrapport before Thursday", created_at: now },
        ],
      };
    }
    this.data = data;
    this.save();
  }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch {} }
  async session() { return { demo: true }; }
  async signIn() {}
  async signOut() {}
  async getTasks() { return structuredClone(this.data.tasks); }
  async addTask(t) { const row = { id: uid(), created_at: new Date().toISOString(), status: "todo", starred: false, ...t }; this.data.tasks.push(row); this.save(); return row; }
  async updateTask(id, patch) { const t = this.data.tasks.find((x) => x.id === id); Object.assign(t, patch); this.save(); return t; }
  async deleteTask(id) { this.data.tasks = this.data.tasks.filter((x) => x.id !== id); this.save(); }
  async getCourses() { return structuredClone(this.data.courses).sort((a, b) => a.sort - b.sort); }
  async saveCourse(c) {
    if (c.id) { Object.assign(this.data.courses.find((x) => x.id === c.id), c); }
    else { c = { id: uid(), sort: this.data.courses.length, ...c }; this.data.courses.push(c); }
    this.save(); return c;
  }
  async deleteCourse(id) { this.data.courses = this.data.courses.filter((x) => x.id !== id); this.save(); }
  async getNotes() { return structuredClone(this.data.notes); }
  async addNote(text) { const n = { id: uid(), text, created_at: new Date().toISOString() }; this.data.notes.push(n); this.save(); return n; }
  async deleteNote(id) { this.data.notes = this.data.notes.filter((x) => x.id !== id); this.save(); }
  resetDemo() { localStorage.removeItem(this.key); }
}

class SupabaseStore {
  mode = "cloud";
  async init() {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    return this;
  }
  check({ data, error }) { if (error) throw new Error(error.message); return data; }
  async session() { const { data } = await this.sb.auth.getSession(); return data.session; }
  async signIn(email, password) { this.check(await this.sb.auth.signInWithPassword({ email, password })); }
  async signOut() { await this.sb.auth.signOut(); }
  async getTasks() { return this.check(await this.sb.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })); }
  async addTask(t) { return this.check(await this.sb.from("tasks").insert(t).select().single()); }
  async updateTask(id, patch) { return this.check(await this.sb.from("tasks").update(patch).eq("id", id).select().single()); }
  async deleteTask(id) { this.check(await this.sb.from("tasks").delete().eq("id", id)); }
  async getCourses() { return this.check(await this.sb.from("courses").select("*").order("sort")); }
  async saveCourse(c) {
    const { id, user_id, created_at, ...fields } = c;
    if (id) return this.check(await this.sb.from("courses").update(fields).eq("id", id).select().single());
    return this.check(await this.sb.from("courses").insert(fields).select().single());
  }
  async deleteCourse(id) { this.check(await this.sb.from("courses").delete().eq("id", id)); }
  async getNotes() { return this.check(await this.sb.from("notes").select("*").order("created_at")); }
  async addNote(text) { return this.check(await this.sb.from("notes").insert({ text }).select().single()); }
  async deleteNote(id) { this.check(await this.sb.from("notes").delete().eq("id", id)); }
}

export async function createStore() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) return new SupabaseStore().init();
  return new LocalStore();
}
