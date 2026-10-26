/**
 * Two-month realistic life seed for the English demo account (en-demo@ting97.cn).
 *
 * Persona: Alex — product engineer in Shanghai, 61 days (2026-08-26 → 2026-10-25) of
 * coherent life: sub-4 marathon build-up, an AI side-project course, dating Emma,
 * weekly Mom calls, colleagues, a Hangzhou weekend (Oct 10-11), Wei's wedding
 * (Sep 20), Emma's birthday (Oct 3), parents' visit (Oct 17-18), a v1.2 launch
 * crunch (Sep 8-12) — moments + schedule + finance + people + diet + todos,
 * all English free-text with Chinese enum values (schema contract).
 *
 * Direct DB writes (deterministic, zero LLM cost — unlike seed-demo-en.mjs which
 * exercises the live pipeline for a handful of moments). Idempotent: wipes the
 * account's feed-domain data first, keeps builtin sport space / sleep / fitness.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/qa/seed-life-2mo.mjs [--dry] [--email=...]
 */
import { Client } from "pg";

const DRY = process.argv.includes("--dry");
const EMAIL = (process.argv.find((a) => a.startsWith("--email=")) ?? "--email=en-demo@ting97.cn").split("=")[1];
if (!process.env.DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

// ---- deterministic RNG (same data every run) ----
let seed = 0x20261026;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p) => rnd() < p;
const yuan = (n) => Math.round(n * 100);

// ---- Beijing-time helpers ----
const bj = (ymd, hm) => new Date(`${ymd}T${hm}:00+08:00`).toISOString();
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function* days(fromYmd, toYmd) {
  for (let d = new Date(`${fromYmd}T00:00:00Z`); ymdOf(d) <= toYmd; d = new Date(d.getTime() + 86_400_000)) yield ymdOf(d);
}

// ---- output accumulators ----
const E = [];   // entries: {at, text, mood?, score?, spaceKey?, source?, rec:[]}
const B = [];   // blocks: {activityId, title, ymd, start, end, entryIdx?, spaceKey?}
const T = [];   // transactions: {dir, cents, cat, cp?, note?, at, entryIdx?}
const D = [];   // diet: {entryIdx, meal, items}
const P = [];   // people: {contact, type, summary, at, entryIdx?}
const TD = [];  // todos
const RF = [];  // reflections
const occupancy = new Map(); // ymd -> [[startMin,endMin]] — conflict-free block insertion
const mins = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const addBlock = (ymd, b) => {
  const list = occupancy.get(ymd) ?? [];
  const s = mins(b.start), e = mins(b.end);
  if (s >= e || list.some(([a, z]) => s < z && e > a)) { console.warn(`[seed] skip overlapping/invalid block ${ymd} ${b.title}`); return; }
  list.push([s, e]); occupancy.set(ymd, list); B.push({ ...b, ymd });
};

const entry = (at, text, o = {}) => { E.push({ at, text, rec: o.rec ?? ["mood"], ...o }); return E.length - 1; };
const tx = (t) => { T.push(t); return T.length - 1; };

// =====================================================================
// Story constants
// =====================================================================
const START = "2026-08-26", END = "2026-10-25";
const LONG_RUNS = { "2026-08-30": 10, "2026-09-06": 12, "2026-09-13": 14, "2026-09-20": 16, "2026-09-27": 18, "2026-10-04": 20, "2026-10-11": 15, "2026-10-25": 12 }; // Sundays (+ manual 22k Sat Oct 17)
const CRUNCH = new Set(["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"]); // v1.2 launch week
const PLANNING = new Set(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
const HZ_TRIP = new Set(["2026-10-10", "2026-10-11"]);        // Hangzhou weekend
const PARENTS = new Set(["2026-10-17", "2026-10-18"]);        // parents visit
const BIRTHDAY = "2026-10-03";                                // Emma's birthday (Sat)
const BOOK_CLUB = new Set(["2026-09-25", "2026-10-23"]);      // Friday evenings with Sarah (skips date night)
const WORK_TITLES = ["Deep work: API refactor", "Deep work: onboarding flow", "Deep work: search relevance", "Write tech spec", "Deep work: billing dashboard", "Fix flaky E2E tests", "Deep work: RAG prototype", "Docs & 1:1s"];
const PM_TITLES = { Mon: "Sprint planning", Wed: "Design review", Fri: "Demo & retro" };

const CONTACTS = [
  { key: "emma", name: "Emma", group: "朋友", importance: 5, intimacy: 92, birthday: "1996-10-03", notes: "Girlfriend. Marathon buddy, met at a running club." },
  { key: "mom", name: "Mom", group: "家人", importance: 5, intimacy: 88, birthday: "1968-10-19", notes: "Video call every Sunday evening." },
  { key: "dad", name: "Dad", group: "家人", importance: 4, intimacy: 76, notes: "Loves hiking; sends long voice messages." },
  { key: "jason", name: "Jason", group: "朋友", importance: 4, intimacy: 70, notes: "College roommate. Badminton partner." },
  { key: "ryan", name: "Ryan", group: "同事", importance: 4, intimacy: 55, notes: "Backend lead, pairing buddy." },
  { key: "priya", name: "Priya", group: "同事", importance: 3, intimacy: 45, notes: "PM on the growth team." },
  { key: "daniel", name: "Daniel", group: "同事", importance: 3, intimacy: 40, notes: "Design lead." },
  { key: "sarah", name: "Sarah", group: "朋友", importance: 3, intimacy: 42, notes: "Book club organizer." },
  { key: "wei", name: "Wei", group: "同事", importance: 2, intimacy: 25, notes: "Got married Sep 20." },
];
const contactKeyByName = { Ryan: "ryan", Priya: "priya", Daniel: "daniel", Emma: "emma" };

// =====================================================================
// Day loop
// =====================================================================
for (const ymd of days(START, END)) {
  const dow = DOW[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
  const isWk = dow !== "Sat" && dow !== "Sun";
  const special = HZ_TRIP.has(ymd) || PARENTS.has(ymd) || ymd === BIRTHDAY;

  // ---- monthly anchors ----
  if (ymd === "2026-09-01" || ymd === "2026-10-01") {
    tx({ dir: "out", cents: yuan(4500), cat: "居住", cp: "Landlord", note: "Monthly rent", at: bj(ymd, "09:05") });
  }
  if (ymd === "2026-09-10" || ymd === "2026-10-10") {
    tx({ dir: "in", cents: yuan(26000), cat: "其他", cp: "Acme Tech", note: "Monthly salary", at: bj(ymd, "09:00") });
    entry(bj(ymd, "09:12"), "Salary landed. Moving 8k straight to savings this month.", { mood: "content", score: 45, rec: ["mood", "finance"] });
  }
  if (ymd === "2026-09-02") {
    tx({ dir: "out", cents: yuan(1288), cat: "学习", cp: "Coursera", note: "AI engineer specialization", at: bj(ymd, "21:40") });
    entry(bj(ymd, "21:45"), "Enrolled in the AI engineer specialization — 1288, worth it for the RAG modules.", { mood: "motivated", score: 55, rec: ["mood", "finance"], spaceKey: "ai" });
  }

  // ---- weekday skeleton ----
  if (isWk && !special) {
    addBlock(ymd, { activityId: "work", title: pick(WORK_TITLES), start: "09:30", end: "12:00" });
    const lunchWith = chance(0.35) ? pick(["Ryan", "Priya", "Daniel", "Emma"]) : null;
    if (lunchWith) {
      const cost = ri(3000, 5800);
      const place = pick(["Ramen Ya", "Wagas", "Noodle House", "Sushi Go"]);
      const idx = entry(bj(ymd, "13:08"), `Lunch with ${lunchWith} at ${pick(["the ramen place", "Wagas", "the noodle shop", "Sushi Go"])}, spent ${(cost / 100).toFixed(0)}.`, { mood: pick(["happy", "relaxed"]), score: 45, rec: ["schedule", "finance", "mood", "diet", "people"] });
      addBlock(ymd, { activityId: "social", title: `Lunch with ${lunchWith}`, start: "12:05", end: "13:00", entryIdx: idx });
      tx({ dir: "out", cents: cost, cat: "餐饮", cp: place, at: bj(ymd, "12:50"), entryIdx: idx });
      D.push({ entryIdx: idx, meal: "午餐", items: [{ name: pick(["ramen", "chicken rice", "beef noodles", "salad bowl"]), amount: "1 bowl", kcal: ri(520, 780) }, { name: "iced tea", kcal: 60 }] });
      P.push({ contact: contactKeyByName[lunchWith], type: "见面", summary: `Lunch — ${pick(["roadmap gossip", "project sync", "just catching up", "interview stories"])}`, at: bj(ymd, "12:30"), entryIdx: idx });
    } else {
      addBlock(ymd, { activityId: "other", title: "Lunch break", start: "12:05", end: "12:45" });
      const cost = ri(2200, 4200);
      const food = pick(["chicken rice", "wonton soup", "bento set", "mala tang"]);
      const idx = entry(bj(ymd, "12:52"), `Quick lunch — ${food} ${(cost / 100).toFixed(0)}.`, { rec: ["finance", "diet"] });
      tx({ dir: "out", cents: cost, cat: "餐饮", cp: pick(["Bento Bros", "Wonton Stand", "Food court"]), at: bj(ymd, "12:40"), entryIdx: idx });
      D.push({ entryIdx: idx, meal: "午餐", items: [{ name: food, kcal: ri(480, 720) }] });
    }
    const pmTitle = PM_TITLES[dow];
    if (pmTitle) addBlock(ymd, { activityId: "work", title: pmTitle, start: dow === "Fri" ? "15:00" : "14:00", end: dow === "Fri" ? "16:30" : "15:30" });
    if (chance(0.6) && !CRUNCH.has(ymd)) addBlock(ymd, { activityId: "work", title: pick(["Pairing with Ryan", "Deep work: bug hunt", "Code review + docs", "Deep work: metrics"]), start: "16:00", end: "18:30" });
    if (chance(0.7)) {
      const c = yuan(ri(22, 34));
      const withCroissant = chance(0.3);
      const idx = entry(bj(ymd, `15:${ri(10, 59)}`), `Afternoon americano break ${withCroissant ? "with a croissant " : ""}— ${(c / 100).toFixed(0)} yuan.`, { rec: withCroissant ? ["finance", "diet"] : ["finance"] });
      tx({ dir: "out", cents: c, cat: "餐饮", cp: pick(["Luckin", "Starbucks", "Manner"]), at: E[idx].at, entryIdx: idx });
      if (withCroissant) D.push({ entryIdx: idx, meal: "加餐", items: [{ name: "americano", kcal: 10 }, { name: "croissant", kcal: 270 }] });
    }
    if (chance(0.75)) {
      const cost = ri(2000, 6800);
      const food = pick(["mapo tofu set", "grilled fish", "pasta", "shengjianbao", "curry rice"]);
      const idx = entry(bj(ymd, `20:${ri(10, 40)}`), `Dinner: ${food} — ${(cost / 100).toFixed(0)}.`, { mood: pick(["relaxed", "tired", "content"]), score: ri(20, 40), rec: ["finance", "diet", "mood"] });
      tx({ dir: "out", cents: cost, cat: "餐饮", cp: pick(["local eatery", "home cooking", "delivery"]), at: E[idx].at, entryIdx: idx });
      D.push({ entryIdx: idx, meal: "晚餐", items: [{ name: food, kcal: ri(560, 900) }] });
    }
  }

  // ---- weekday evenings ----
  if (isWk && !special && !CRUNCH.has(ymd)) {
    if (dow === "Mon" || dow === "Wed") {
      addBlock(ymd, { activityId: "study", title: "AI course: RAG module", start: "20:30", end: "22:00", spaceKey: "ai" });
      if (chance(0.7)) entry(bj(ymd, "22:05"), pick(["Finished tonight's course section on embeddings.", "Course lab: built a tiny vector search — 20 lines, works.", "Watched two lectures on chunking strategies."]) + " Brain is full but in a good way.", { mood: "accomplished", score: 55, rec: ["mood"], spaceKey: "ai" });
    }
    if (dow === "Tue") {
      const idx = entry(bj(ymd, "19:55"), `Easy 6k around the park${pick(["", " with the running club", " in the drizzle, very peaceful"])}, legs felt light.`, { mood: "happy", score: 60, rec: ["schedule", "mood"], spaceKey: "run", source: "voice" });
      addBlock(ymd, { activityId: "fitness", title: "Easy run 6k", start: "19:00", end: "19:50", entryIdx: idx, spaceKey: "run" });
    }
    if (dow === "Thu") {
      addBlock(ymd, { activityId: "fitness", title: "Strength: lower body", start: "19:30", end: "20:30", spaceKey: "run" });
      if (chance(0.8)) entry(bj(ymd, "20:40"), `Strength done — ${pick(["squats 5×5 at 80kg", "deadlifts 4×6, grip finally held", "bulgarian split squats, brutal"])}. Marathon strength work.`, { mood: pick(["tired", "accomplished"]), score: 40, rec: ["schedule", "mood"], spaceKey: "run" });
    }
    if (dow === "Fri" && !BOOK_CLUB.has(ymd)) {
      const cost = yuan(ri(120, 360));
      const idx = entry(bj(ymd, "21:40"), `Date night with Emma — ${pick(["hotpot", "that new Italian place", "Mexican + a walk along the river", "movie then late noodles"])}. ${(cost / 100).toFixed(0)} yuan, worth every fen.`, { mood: "happy", score: 65, rec: ["schedule", "finance", "mood", "people"] });
      addBlock(ymd, { activityId: "social", title: "Date night with Emma", start: "19:00", end: "21:30", entryIdx: idx });
      tx({ dir: "out", cents: cost, cat: "餐饮", cp: pick(["Haidilao", "Osteria", "Maya", "UGC Theaters"]), at: bj(ymd, "21:10"), entryIdx: idx });
      P.push({ contact: "emma", type: "见面", summary: pick(["Date night", "Movie + dinner", "River walk after dinner"]), at: bj(ymd, "19:30"), entryIdx: idx });
    }
  }

  // ---- Saturday ----
  if (dow === "Sat" && !special) {
    if (Math.floor((new Date(ymd) - new Date("2026-08-29")) / 604800000) % 2 === 0) {
      const idx = entry(bj(ymd, "17:10"), `Badminton with Jason — ${pick(["lost 2:1, his smashes are unfair", "won 2:0, my defense is improving", "split sets, both wrecked"])}. Court fee 30 each.`, { mood: "happy", score: 55, rec: ["schedule", "finance", "mood", "people"] });
      addBlock(ymd, { activityId: "social", title: "Badminton with Jason", start: "15:00", end: "17:00", entryIdx: idx });
      tx({ dir: "out", cents: yuan(30), cat: "娱乐", cp: "Badminton court", at: bj(ymd, "17:00"), entryIdx: idx });
      P.push({ contact: "jason", type: "见面", summary: "Badminton session", at: bj(ymd, "15:30"), entryIdx: idx });
    }
    if (chance(0.5) && !CRUNCH.has(ymd)) {
      const cost = yuan(ri(60, 130));
      const idx = entry(bj(ymd, `20:${ri(20, 50)}`), `Saturday ${pick(["movie night", "night market stroll", "board games at the cafe"])} — ${(cost / 100).toFixed(0)}.`, { mood: "relaxed", score: 40, rec: ["finance", "mood"] });
      tx({ dir: "out", cents: cost, cat: "娱乐", cp: pick(["IMAX", "Night market", "Dice & Draft"]), at: E[idx].at, entryIdx: idx });
    }
  }

  // ---- Sunday ----
  if (dow === "Sun" && !special) {
    if (LONG_RUNS[ymd]) {
      const km = LONG_RUNS[ymd];
      const dur = Math.round(km * 5.4);
      const end = `${String(Math.floor((450 + dur) / 60)).padStart(2, "0")}:${String((450 + dur) % 60).padStart(2, "0")}`;
      const idx = ymd === "2026-10-04"
        ? entry(bj(ymd, "09:35"), "20k race-pace test: 1:41:30. That's 3:35 marathon pace for the front half — sub-4 is genuinely on.", { mood: "accomplished", score: 70, rec: ["schedule", "mood"], spaceKey: "run" })
        : entry(bj(ymd, end), `${km}k long run done — ${pick(["negative split, felt strong", "hard last 3k but held pace", "legs heavy first half then settled", "beautiful morning by the river"])}.`, { mood: pick(["accomplished", "happy", "tired"]), score: 65, rec: ["schedule", "mood", "diet"], spaceKey: "run", source: "voice" });
      addBlock(ymd, { activityId: "fitness", title: `Long run ${km}k${ymd === "2026-10-04" ? " (race-pace test)" : ""}`, start: "07:30", end, entryIdx: idx, spaceKey: "run" });
      D.push({ entryIdx: idx, meal: "加餐", items: [{ name: "banana + gel", kcal: 140 }, { name: "protein shake", kcal: 160 }] });
      if (ymd === "2026-10-04") tx({ dir: "out", cents: yuan(128), cat: "购物", cp: "Decathlon", note: "Energy gels for long runs", at: bj(ymd, "11:00") });
    } else {
      addBlock(ymd, { activityId: "chores", title: "Groceries & meal prep", start: "10:00", end: "11:00" });
      const g = yuan(ri(180, 320));
      tx({ dir: "out", cents: g, cat: "餐饮", cp: "Hema Fresh", note: "Weekly groceries", at: bj(ymd, "10:45") });
      if (chance(0.7)) {
        const idx = entry(bj(ymd, "11:10"), `Meal prep done — ${pick(["chicken, rice and broccoli ×5", "congee base + braised beef", "salad jars and overnight oats"])}. Groceries ${(g / 100).toFixed(0)}.`, { mood: "content", score: 40, rec: ["finance", "mood", "diet"] });
        D.push({ entryIdx: idx, meal: "午餐", items: [{ name: "meal-prep chicken bowl", kcal: 620 }] });
      }
    }
    const midx = entry(bj(ymd, "20:45"), `Weekly call with Mom — ${pick(["she's walking 8k steps a day now, proud of her", "talked marathon plans, she worries I run too much", "dad's chili plants took over the balcony", "grandma sent pickles again"])}.`, { mood: "content", score: 50, rec: ["schedule", "mood", "people"] });
    addBlock(ymd, { activityId: "social", title: "Video call with Mom", start: "20:00", end: "20:40", entryIdx: midx });
    P.push({ contact: "mom", type: "通话", summary: pick(["Weekly catch-up", "Marathon update", "Family news"]), at: bj(ymd, "20:20"), entryIdx: midx });
    if (chance(0.4)) addBlock(ymd, { activityId: "study", title: "Reading", start: "16:00", end: "17:00" });
  }
  if (dow === "Mon" && chance(0.8) && !special) tx({ dir: "out", cents: yuan(50), cat: "交通", cp: "Metro card", note: "Weekly top-up", at: bj(ymd, "08:40") });

  // ---- launch crunch ----
  if (CRUNCH.has(ymd)) {
    addBlock(ymd, { activityId: "work", title: "Launch war room", start: "19:30", end: "21:00" });
    if (chance(0.6)) tx({ dir: "out", cents: yuan(ri(25, 45)), cat: "餐饮", cp: "Late-night delivery", note: "Overtime dinner", at: bj(ymd, "20:30") });
    if (chance(0.5)) entry(bj(ymd, `22:${ri(10, 50)}`), pick(["v1.2 launch prep — QA found another edge case, fixing.", "Still at it. Migration rehearsal #3 passed though.", "Tired but the launch checklist is almost green.", "Release notes drafted. Sleep now."]), { mood: pick(["tired", "stressed"]), score: -ri(30, 50), rec: ["mood"] });
    if (ymd === "2026-09-12") {
      entry(bj(ymd, "23:05"), "WE SHIPPED v1.2. Nine months of work, zero rollback. Team is unhinged with joy.", { mood: "accomplished", score: 80, rec: ["mood"] });
      addBlock(ymd, { activityId: "social", title: "Launch celebration dinner", start: "21:15", end: "22:45" });
    }
  }
  if (PLANNING.has(ymd) && chance(0.4)) entry(bj(ymd, `18:${ri(20, 50)}`), pick(["Q4 planning drafts — three OKRs, one scary stretch goal.", "Roadmap review day. My RAG proposal made the cut.", "Backlog grooming, said no to 14 features."]), { mood: pick(["content", "calm"]), score: 35, rec: ["mood"] });

  // ---- Hangzhou weekend (Oct 10-11) ----
  if (ymd === "2026-10-10") {
    entry(bj(ymd, "08:15"), "Train to Hangzhou with Emma — 184 each way, round trip 736 booked. Two americanos for the road.", { mood: "excited", score: 65, rec: ["finance", "mood", "people"] });
    tx({ dir: "out", cents: yuan(736), cat: "交通", cp: "China Rail", note: "Round trip ×2", at: bj(ymd, "08:10") });
    P.push({ contact: "emma", type: "见面", summary: "Hangzhou weekend", at: bj(ymd, "08:30") });
    addBlock(ymd, { activityId: "fun", title: "West Lake loop + tea village", start: "13:00", end: "16:30" });
    tx({ dir: "out", cents: yuan(580), cat: "居住", cp: "West Lake Inn", note: "1 night", at: bj(ymd, "17:20") });
    const idx = entry(bj(ymd, "19:20"), "Longjing shrimp + West Lake fish for dinner, 216. Walked the whole lake edge after. Perfect day.", { mood: "happy", score: 70, rec: ["finance", "mood", "diet", "people"] });
    tx({ dir: "out", cents: yuan(216), cat: "餐饮", cp: "West Lake restaurant", at: bj(ymd, "19:00"), entryIdx: idx });
    D.push({ entryIdx: idx, meal: "晚餐", items: [{ name: "longjing shrimp", kcal: 320 }, { name: "west lake fish", kcal: 420 }, { name: "rice", kcal: 230 }] });
    P.push({ contact: "emma", type: "见面", summary: "West Lake walk & dinner", at: bj(ymd, "14:00"), entryIdx: idx });
  }
  if (ymd === "2026-10-11") {
    const idx = entry(bj(ymd, "09:00"), "Ran 15k along the lake at sunrise before checkout — best run of the block so far.", { mood: "accomplished", score: 70, rec: ["schedule", "mood"], spaceKey: "run" });
    addBlock(ymd, { activityId: "fitness", title: "Long run 15k (lakeside)", start: "07:30", end: "08:50", entryIdx: idx, spaceKey: "run" });
    entry(bj(ymd, "16:30"), "Train home, feet up, laundry mountain awaits. Great weekend.", { mood: "content", score: 45, rec: ["mood"] });
  }

  // ---- Wei's wedding (Sep 20, Sun) ----
  if (ymd === "2026-09-20") {
    tx({ dir: "out", cents: yuan(800), cat: "人情往来", cp: "Wei", note: "Wedding gift", at: bj(ymd, "10:30") });
    const idx = entry(bj(ymd, "15:40"), "Wei's wedding — beautiful ceremony, cried a little. Gift 800, absolutely worth it.", { mood: "happy", score: 60, rec: ["finance", "mood", "people"] });
    P.push({ contact: "wei", type: "送礼", summary: "Wedding gift & ceremony", at: bj(ymd, "11:30"), entryIdx: idx });
    addBlock(ymd, { activityId: "social", title: "Wei's wedding", start: "11:00", end: "14:30" });
  }

  // ---- Emma's birthday (Oct 3, Sat) ----
  if (ymd === BIRTHDAY) {
    tx({ dir: "out", cents: yuan(599), cat: "购物", cp: "Jewelry studio", note: "Birthday necklace", at: bj(ymd, "10:20") });
    tx({ dir: "out", cents: yuan(386), cat: "餐饮", cp: "Ristorante Marco", note: "Birthday dinner", at: bj(ymd, "20:10") });
    const idx = entry(bj(ymd, "21:50"), "Emma's birthday. She loved the necklace (599 — the engraving idea worked). Dinner at Marco's 386, then night walk. Best day this month.", { mood: "happy", score: 75, rec: ["finance", "mood", "people"] });
    P.push({ contact: "emma", type: "送礼", summary: "Birthday necklace + dinner", at: bj(ymd, "20:00"), entryIdx: idx });
    addBlock(ymd, { activityId: "social", title: "Emma's birthday dinner", start: "18:30", end: "21:30", entryIdx: idx });
  }

  // ---- parents visit (Oct 17-18) + Mom's birthday (Oct 19) ----
  if (ymd === "2026-10-17") {
    const ridx = entry(bj(ymd, "08:20"), "22k peak-week long run DONE at sunrise, then straight to the station to pick up my parents. Two-a-day life.", { mood: "tired", score: 55, rec: ["schedule", "mood"], spaceKey: "run" });
    addBlock(ymd, { activityId: "fitness", title: "Long run 22k (peak week)", start: "05:50", end: "08:10", entryIdx: ridx, spaceKey: "run" });
    const idx = entry(bj(ymd, "20:30"), "Hotpot with Mom and Dad — they approved of the new apartment, high praise indeed. 456.", { mood: "happy", score: 65, rec: ["finance", "mood", "people", "diet"] });
    tx({ dir: "out", cents: yuan(456), cat: "餐饮", cp: "Haidilao", at: bj(ymd, "20:20"), entryIdx: idx });
    D.push({ entryIdx: idx, meal: "晚餐", items: [{ name: "hotpot spread", kcal: 1100 }] });
    P.push({ contact: "mom", type: "见面", summary: "Parents arrived — hotpot dinner", at: bj(ymd, "18:40"), entryIdx: idx });
    P.push({ contact: "dad", type: "见面", summary: "Parents visit day 1", at: bj(ymd, "18:40") });
    addBlock(ymd, { activityId: "social", title: "Dinner with parents", start: "18:00", end: "21:00", entryIdx: idx });
  }
  if (ymd === "2026-10-18") {
    addBlock(ymd, { activityId: "fun", title: "Bund walk with parents", start: "10:00", end: "12:30" });
    tx({ dir: "out", cents: yuan(300), cat: "购物", cp: "Tea house", note: "Tea gift for parents", at: bj(ymd, "14:30") });
    const idx = entry(bj(ymd, "15:10"), "Walked the Bund with the parents, bought them the oolong they liked (300). Mom kept taking photos of me. Sent them off on the 4pm train.", { mood: "content", score: 55, rec: ["finance", "mood", "people"] });
    P.push({ contact: "dad", type: "送礼", summary: "Tea gift + station send-off", at: bj(ymd, "14:00"), entryIdx: idx });
  }
  if (ymd === "2026-10-19") {
    tx({ dir: "out", cents: yuan(520), cat: "人情往来", cp: "Mom", note: "Birthday red packet", at: bj(ymd, "09:15") });
    const idx = entry(bj(ymd, "09:20"), "Mom's birthday — red packet sent first thing in the morning. Call tonight with the whole family.", { mood: "content", score: 55, rec: ["finance", "mood", "people"] });
    P.push({ contact: "mom", type: "送礼", summary: "Birthday red packet", at: bj(ymd, "09:15"), entryIdx: idx });
  }

  // ---- misc one-offs ----
  if (ymd === "2026-09-06") tx({ dir: "out", cents: yuan(699), cat: "购物", cp: "Decathlon", note: "Running shoes (old pair dead at 800km)", at: bj(ymd, "14:30") });
  if (ymd === "2026-09-25") {
    TD.push({ title: "Dentist appointment", status: "done", dueAt: bj(ymd, "15:00"), doneAt: bj(ymd, "15:50") });
    tx({ dir: "out", cents: yuan(240), cat: "其他", cp: "Dental clinic", note: "Cleaning + check", at: bj(ymd, "15:45") });
    entry(bj(ymd, "16:00"), "Dentist: no cavities, keep flossing. 240 well spent.", { rec: ["finance"] });
  }
  if (ymd === "2026-10-25") entry(bj(ymd, "10:20"), "Two months of base building done: 412km total, resting HR down 6. Taper starts now — race day in 21 days. Grateful I started this log.", { mood: "accomplished", score: 75, rec: ["mood"], spaceKey: "run" });
}

// ---- book club (monthly, with Sarah) ----
for (const [ymd, book] of [["2026-09-25", "Deep Work"], ["2026-10-23", "The Making of a Manager"]]) {
  const idx = entry(bj(ymd, "21:30"), `Book club night — ${book} discussion ran long, good arguments. Tea 42.`, { mood: "relaxed", score: 45, rec: ["finance", "mood", "people"] });
  tx({ dir: "out", cents: yuan(42), cat: "娱乐", cp: "Anxi Tea House", at: bj(ymd, "20:40"), entryIdx: idx });
  P.push({ contact: "sarah", type: "见面", summary: `Book club: ${book}`, at: bj(ymd, "19:30"), entryIdx: idx });
  addBlock(ymd, { activityId: "social", title: `Book club: ${book}`, start: "19:30", end: "21:30", entryIdx: idx });
}

// ---- todos ----
TD.push(
  { title: "Register for Nov 15 city marathon", status: "done", dueAt: bj("2026-09-05", "12:00"), doneAt: bj("2026-09-05", "11:40"), spaceKey: "run" },
  { title: "Ship v1.2 launch checklist", status: "done", dueAt: bj("2026-09-12", "18:00"), doneAt: bj("2026-09-12", "22:50") },
  { title: "Course module 3 quiz", status: "done", dueAt: bj("2026-09-16", "23:00"), doneAt: bj("2026-09-16", "21:10"), spaceKey: "ai" },
  { title: "Book Hangzhou hotel", status: "done", dueAt: bj("2026-10-09", "21:00"), doneAt: bj("2026-10-08", "22:30") },
  { title: "Buy Wei's wedding gift", status: "done", dueAt: bj("2026-09-19", "20:00"), doneAt: bj("2026-09-18", "19:00") },
  { title: "Buy Emma's birthday gift", status: "done", dueAt: bj("2026-10-02", "20:00"), doneAt: bj("2026-10-01", "18:40") },
  { title: "Passport photos", status: "done", dueAt: bj("2026-10-09", "18:00"), doneAt: bj("2026-10-08", "17:20") },
  { title: "Course module 4 quiz", status: "done", dueAt: bj("2026-10-14", "23:00"), doneAt: bj("2026-10-14", "20:30"), spaceKey: "ai" },
  { title: "Draft RAG demo architecture", status: "done", dueAt: bj("2026-10-20", "22:00"), doneAt: bj("2026-10-20", "21:45"), spaceKey: "ai" },
  { title: "Passport renewal interview", status: "pending", dueAt: bj("2026-10-30", "10:00"), important: true },
  { title: "Book hotel near the start line", status: "pending", dueAt: bj("2026-11-01", "21:00"), spaceKey: "run", important: true },
  { title: "Course module 5 homework", status: "pending", dueAt: bj("2026-10-28", "23:00"), spaceKey: "ai" },
  { title: "Set up vector DB prototype", status: "pending", dueAt: bj("2026-10-29", "22:00"), spaceKey: "ai" },
  { title: "Review Q4 OKR draft", status: "pending", dueAt: bj("2026-10-27", "18:00") },
  { title: "Call grandma", status: "pending", dueAt: bj("2026-10-28", "20:00") },
  { title: "Order foam roller", status: "pending", today: true },
  { title: "Prep Monday demo", status: "pending", today: true, important: true },
  { title: "Recovery stretches + roll", status: "pending", today: true },
  { title: "Order race-day gels", status: "pending", dueAt: bj("2026-11-08", "21:00"), spaceKey: "run" },
  { title: "Write taper-week plan", status: "pending", dueAt: bj("2026-11-02", "20:00"), spaceKey: "run" },
);

// ---- space reflections ----
RF.push(
  { spaceKey: "run", content: "Week 5: 42km this week. The easy-pace discipline is paying off — resting HR down from 62 to 58. New shoes (Decathlon, 699) at 800km were overdue.", at: bj("2026-09-27", "21:00") },
  { spaceKey: "run", content: "20k race-pace test at 1:41:30. Did the math: if the back half only fades 8%, that's 3:52. Sub-4 is real if I nail the taper. Booking the start-line hotel now.", at: bj("2026-10-04", "12:30") },
  { spaceKey: "run", content: "Peak week: 51km with the 22k long run before picking up my parents. Two months of base done — 412km total, zero injuries. Taper starts Monday.", at: bj("2026-10-25", "10:40") },
  { spaceKey: "ai", content: "RAG prototype architecture drafted: chunking + hybrid retrieval + rerank. The course labs map almost 1:1 onto my side project — module 5 (evals) is the missing piece.", at: bj("2026-10-20", "22:00") },
);

// =====================================================================
// Dry-run summary / DB write
// =====================================================================
const monthTotals = {};
for (const t of T) monthTotals[t.at.slice(0, 7)] = (monthTotals[t.at.slice(0, 7)] ?? 0) + (t.dir === "out" ? t.cents : 0);
console.log(`[seed] plan: entries=${E.length} blocks=${B.length} tx=${T.length} (out ${Object.entries(monthTotals).map(([m, c]) => `${m}:¥${(c / 100).toFixed(0)}`).join(" ")}) todos=${TD.length} diet=${D.length} people=${P.length} contacts=${CONTACTS.length} reflections=${RF.length}`);
if (DRY) { console.log("[seed] dry run — nothing written"); process.exit(0); }

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  const { rows: u } = await client.query("select id from profiles where email=$1", [EMAIL]);
  if (!u.length) throw new Error(`user not found: ${EMAIL}`);
  const uid = u[0].id;
  console.log("[seed] user", uid);

  // ---- wipe feed-domain data (keep: builtin sport space, sleep logs, fitness) ----
  for (const sql of [
    "delete from interactions where user_id=$1",
    "delete from transactions where user_id=$1",
    "delete from diet_records where user_id=$1",
    "delete from entry_recognitions where user_id=$1",
    "delete from todos where user_id=$1",
    "delete from time_blocks where user_id=$1",
    "delete from space_reflections where user_id=$1",
    "delete from review_caches where user_id=$1",
    "delete from entries where user_id=$1",
    "delete from goal_spaces where user_id=$1 and kind is null",
    "delete from contacts where user_id=$1",
  ]) await client.query(sql, [uid]);

  // ---- contacts ----
  const cid = {};
  for (const ct of CONTACTS) {
    const { rows } = await client.query(
      "insert into contacts (user_id, name, group_tag, importance, intimacy, birthday, notes) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [uid, ct.name, ct.group, ct.importance, ct.intimacy, ct.birthday, ct.notes],
    );
    cid[ct.key] = rows[0].id;
  }

  // ---- spaces: keep builtin sport; create run + ai ----
  const spid = { run: null, ai: null };
  const { rows: r1 } = await client.query(
    "insert into goal_spaces (user_id, name, description, icon, color, started_at, target_date, sort) values ($1,$2,$3,$4,$5,$6,$7,1) returning id",
    [uid, "Sub-4 Marathon", "City marathon Nov 15 — build base Aug→Oct, taper, race 3:59.", "🏃", "#f97316", "2026-08-01", "2026-11-15"],
  );
  spid.run = r1[0].id;
  const { rows: r2 } = await client.query(
    "insert into goal_spaces (user_id, name, description, icon, color, started_at, sort) values ($1,$2,$3,$4,$5,$6,2) returning id",
    [uid, "AI Side Project", "Ship a RAG note-taking demo by December — one course module and one prototype step per week.", "🤖", "#8b5cf6", "2026-09-01"],
  );
  spid.ai = r2[0].id;

  // ---- entries + recognitions ----
  const eid = [];
  for (const e of E) {
    const { rows } = await client.query(
      "insert into entries (user_id, source, raw_text, mood, mood_score, created_at, analyzed_at, space_id) values ($1,$2,$3,$4,$5,$6,$6,$7) returning id",
      [uid, e.source ?? "keyboard", e.text, e.mood ?? null, e.score ?? null, e.at, e.spaceKey ? spid[e.spaceKey] : null],
    );
    eid.push(rows[0].id);
    for (const dom of e.rec) {
      await client.query(
        "insert into entry_recognitions (user_id, entry_id, domain, status, result, confidence, engine) values ($1,$2,$3,'applied','{}',$4,'llm')",
        [uid, rows[0].id, dom, 0.85 + rnd() * 0.12],
      );
    }
  }

  // ---- blocks ----
  for (const b of B) {
    await client.query(
      "insert into time_blocks (user_id, entry_id, activity_id, title, start_at, end_at, time_mode, source, created_at) values ($1,$2,$3,$4,$5,$6,'explicit','keyboard',$5)",
      [uid, b.entryIdx !== undefined ? eid[b.entryIdx] : null, b.activityId, b.title, bj(b.ymd, b.start), bj(b.ymd, b.end)],
    );
  }

  // ---- transactions ----
  const xid = [];
  for (const t of T) {
    const { rows } = await client.query(
      "insert into transactions (user_id, entry_id, direction, amount_cents, category, counterparty, note, occurred_at, source, is_draft, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,'keyboard',false,$8) returning id",
      [uid, t.entryIdx !== undefined ? eid[t.entryIdx] : null, t.dir, t.cents, t.cat, t.cp ?? null, t.note ?? null, t.at],
    );
    xid.push(rows[0].id);
  }

  // ---- diet ----
  for (const d of D) {
    const total = d.items.reduce((s, i) => s + (i.kcal ?? 0), 0);
    await client.query(
      "insert into diet_records (user_id, entry_id, meal, items, total_kcal) values ($1,$2,$3,$4::jsonb,$5)",
      [uid, eid[d.entryIdx], d.meal, JSON.stringify(d.items), total],
    );
  }

  // ---- interactions ----
  for (const p of P) {
    await client.query(
      "insert into interactions (user_id, contact_id, entry_id, type, summary, occurred_at) values ($1,$2,$3,$4,$5,$6)",
      [uid, cid[p.contact], p.entryIdx !== undefined ? eid[p.entryIdx] : null, p.type, p.summary, p.at],
    );
  }

  // ---- todos ----
  for (const t of TD) {
    const createdAt = t.today ? bj("2026-10-26", "08:30") : (t.doneAt ?? t.dueAt ?? bj("2026-09-01", "09:00"));
    const remindAt = t.dueAt ? new Date(Date.parse(t.dueAt) - 15 * 60_000).toISOString() : null;
    await client.query(
      "insert into todos (user_id, title, status, due_at, done_at, space_id, today_tag_date, is_important, source, created_at, remind_at) values ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7,$8,'manual',$9::timestamptz,$10::timestamptz)",
      [uid, t.title, t.status, t.dueAt ?? null, t.doneAt ?? null, t.spaceKey ? spid[t.spaceKey] : null, t.today ? "2026-10-26" : null, t.important ?? false, createdAt, remindAt],
    );
  }

  // ---- reflections ----
  for (const r of RF) {
    await client.query("insert into space_reflections (user_id, space_id, content, created_at) values ($1,$2,$3,$4)", [uid, spid[r.spaceKey], r.content, r.at]);
  }

  // ---- budget ----
  await client.query(
    "insert into budgets (user_id, monthly_limit_cents, alert_threshold) values ($1,$2,80) on conflict (user_id) do update set monthly_limit_cents=$2, alert_threshold=80, updated_at=now()",
    [uid, yuan(12000)],
  );

  await client.query("commit");
  console.log(`[seed] written: entries=${E.length} blocks=${B.length} tx=${T.length} todos=${TD.length} diet=${D.length} people=${P.length}`);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("[seed] FAILED, rolled back:", String(e).slice(0, 400));
  process.exit(1);
} finally {
  await client.end();
}
