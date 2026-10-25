/**
 * English demo seed — one-shot, six domains, all-English data for the judges' demo account.
 * Usage:
 *   BASE_URL=https://host SEED_EMAIL=you@example.com SEED_PASSWORD=xxx node scripts/qa/seed-demo-en.mjs
 * Notes: enumerated values stored in DB stay Chinese (餐饮/交通… — schema whitelist),
 * only free-text (notes/titles/names) is English. Moments go through the real AI pipeline,
 * which doubles as an end-to-end check of English-language extraction.
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
let COOKIE = "";
if (process.env.SEED_EMAIL) {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD || "" }),
  });
  COOKIE = (r.headers.get("set-cookie") || "").split(";")[0];
  if (!COOKIE) {
    console.error("[seed] login failed — check SEED_EMAIL/SEED_PASSWORD");
    process.exit(1);
  }
  console.log("[seed] signed in as", process.env.SEED_EMAIL);
}

const j = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(COOKIE ? { cookie: COOKIE } : {}), origin: BASE, "sec-fetch-site": "same-origin" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
};

const NOW = new Date();
const dayYmd = (offset) => {
  const d = new Date(NOW.getTime() + offset * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const at = (offset, hm) => {
  const [h, mi] = hm.split(":").map(Number);
  return new Date(`${dayYmd(offset)}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+08:00`).toISOString();
};

// ---------- 1. Moments (English, through the AI extraction pipeline) ----------
// idempotent: skip posting if any seed moment already exists
const { entries: existingEntries } = await j("GET", "/api/feed?limit=100").catch(() => ({ entries: [] }));
const MOMENTS = [
  "Morning run 40 minutes at an easy pace, feeling great",
  "Taxi to the office, paid 32 yuan",
  "Standup meeting 9:30 to 10:00, then deep work on the API refactor",
  "Lunch with Emma at the ramen place, spent 128 — so good",
  "Sent Mom 500 for her birthday",
  "Two cups of americano and a croissant this afternoon",
  "A bit anxious about Friday's demo, need to rehearse twice tomorrow",
  "Evening gym: 45 min strength (squats/bench) + 15 min stretching",
];
const have = new Set((existingEntries || []).map((e) => e.raw_text ?? e.text ?? ""));
for (const m of MOMENTS) {
  if (have.has(m)) { console.log("[seed] moment exists, skip", m.slice(0, 40)); continue; }
  await j("POST", "/api/parse", { text: m });
  console.log("[seed] moment ✓", m.slice(0, 40));
}
// give the async AI pipeline a moment, then report recognition results
await new Promise((r) => setTimeout(r, 25_000));
const { entries } = await j("GET", "/api/feed?limit=20").catch(() => ({ entries: [] }));
const pending = (entries || []).filter((e) => e.analyzed_at == null).length;
console.log(`[seed] moments done; still-analyzing=${pending}`);

// ---------- 2. Finance (manual entries; category values must stay Chinese) ----------
await j("PUT", "/api/budget", { monthlyLimitCents: 200000, alertThreshold: 80 });
console.log("[seed] budget 2000/month");
const TX = [
  { direction: "out", amountCents: 360000, category: "居住", counterparty: "Landlord", note: "Monthly rent", occurredAt: at(-10, "10:00") },
  { direction: "in", amountCents: 2600000, category: "其他", counterparty: "Acme Corp", note: "Salary", occurredAt: at(-10, "09:00") },
  { direction: "out", amountCents: 189000, category: "购物", counterparty: "Amazon", note: "Monitor arm", occurredAt: at(-6, "20:00") },
  { direction: "out", amountCents: 7800, category: "交通", counterparty: "Metro card", note: "Top-up", occurredAt: at(-3, "08:30") },
];
for (const tx of TX) await j("POST", "/api/transactions", tx);
console.log(`[seed] transactions ×${TX.length}`);

// ---------- 3. Todos ----------
const t1 = await j("POST", "/api/todos", { title: "Rehearse Friday demo twice", dueAt: at(1, "20:00") });
await j("POST", "/api/todos", { title: "Read 20 pages of Deep Work", today: true });
await j("POST", "/api/todos", { title: "Book dentist appointment", dueAt: at(3, "15:00") });
await j("POST", "/api/todos", { title: "Trim slide deck to 10 pages", parentId: t1.todo.id });
console.log("[seed] todos ×4");

// ---------- 4. Contacts & interactions ----------
// AI extraction may have auto-created contacts (people domain) — find-or-create
const { contacts: existing } = await j("GET", "/api/contacts");
const findOrCreate = async (name, body) => {
  const hit = (existing || []).find((c) => c.name === name);
  if (hit) return hit;
  const r = await j("POST", "/api/contacts", { name, ...body });
  return r.contact ?? r;
};
const emma = await findOrCreate("Emma", { group: "朋友", importance: 5, note: "College roommate, runs marathons" });
const ryan = await findOrCreate("Ryan", { group: "同事", importance: 4, note: "Backend lead" });
await findOrCreate("Mom", { group: "家人", importance: 5, birthday: "1968-03-12" });
await j("POST", `/api/contacts/${emma.id}/interactions`, { type: "聚餐", note: "Ramen lunch", interactedAt: at(0, "12:30") });
await j("POST", `/api/contacts/${ryan.id}/interactions`, { type: "工作", note: "API refactor pairing", interactedAt: at(-1, "15:00") });
console.log("[seed] contacts ×3 + interactions ×2");

// ---------- 5. Goal spaces ----------
const run = await j("POST", "/api/spaces", { name: "Run a sub-4 marathon", description: "Build base mileage and lose 3kg first" });
await j("POST", "/api/todos", { title: "Weekly long run 25km", spaceId: run.space.id, dueAt: at(2, "07:00") });
await j("POST", `/api/spaces/${run.space.id}/reflections`, { content: "Week 6 base building done. Legs feel fresh — the easy-paced runs are paying off." });
console.log("[seed] goal space ✓");

// ---------- 6. Time blocks ----------
const { activities } = await j("GET", "/api/activities");
const actId = (id) => activities.find((a) => a.id === id)?.id ?? activities[0]?.id ?? "other";
const BLK = [
  { title: "Deep work: API refactor", activityId: actId("work"), startAt: at(0, "09:00"), endAt: at(0, "11:30") },
  { title: "Lunch with Emma", activityId: actId("social"), startAt: at(0, "12:00"), endAt: at(0, "13:00") },
  { title: "Strength training", activityId: actId("fitness"), startAt: at(0, "18:30"), endAt: at(0, "19:30") },
  { title: "Reading", activityId: actId("study"), startAt: at(-1, "21:00"), endAt: at(-1, "22:00") },
];
for (const b of BLK) await j("POST", "/api/blocks", b).catch((e) => console.log("[seed] block skipped (conflict):", String(e).slice(0, 80)));
console.log(`[seed] time blocks ×${BLK.length}`);

// ---------- 7. Fitness & sleep ----------
await j("POST", "/api/fitness/sleep", { date: dayYmd(0), hours: 7.5, feeling: "good", score: 82 });
await j("POST", "/api/fitness/sleep", { date: dayYmd(-1), hours: 6.5, feeling: "ok", score: 70 });
await j("POST", "/api/fitness/metrics", { measuredOn: dayYmd(0), weightKg: 71.2 });
await j("POST", "/api/fitness/plans", {
  planDate: dayYmd(1),
  moduleCode: "strength",
  source: "manual",
  content: { title: "Leg day", durationMin: 55, exercises: [{ name: "Back squat", sets: 4, repsText: "8", weightG: 80000, rir: 2 }] },
});
console.log("[seed] fitness & sleep ✓");

console.log("[seed] English demo seed complete ✓");
