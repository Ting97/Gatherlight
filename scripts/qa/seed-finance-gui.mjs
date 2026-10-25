/**
 * 深度体验(财务模块)种子数据——打到本地 3100(AUTH_DISABLED=1, 测试库)。
 * 用后即弃:qa 脚本自清理约定见 scripts/qa/。运行: node scripts/qa/seed-finance-gui.mjs --wipe 可清掉本脚本数据。
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
// 远程/演示环境：BASE_URL 指定目标，SEED_PHONE/SEED_PASSWORD 提供则先登录拿会话 cookie
let COOKIE = "";
if (process.env.SEED_PHONE) {
  const r = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: process.env.SEED_PHONE, password: process.env.SEED_PASSWORD || "" }),
  });
  COOKIE = (r.headers.get("set-cookie") || "").split(";")[0];
  if (!COOKIE) {
    console.error("[seed] 登录失败——检查 SEED_PHONE/SEED_PASSWORD");
    process.exit(1);
  }
  console.log("[seed] 已登录", process.env.SEED_PHONE);
}

const NOW = new Date();
const Y = NOW.getUTCFullYear();
const M = NOW.getUTCMonth() + 1;
const month = `${Y}-${String(M).padStart(2, "0")}`;
const prevMonth = M === 1 ? `${Y - 1}-12` : `${Y}-${String(M - 1).padStart(2, "0")}`;
/** 北京时间当月某日 12:00 的 ISO(按 UTC+8 反推) */
const at = (day, hm = "12:00") => {
  const [h, mi] = hm.split(":").map(Number);
  return new Date(`${month}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+08:00`).toISOString();
};
const prevAt = (day, hm = "12:00") => {
  const [h, mi] = hm.split(":").map(Number);
  return new Date(`${prevMonth}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+08:00`).toISOString();
};

const j = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(COOKIE ? { cookie: COOKIE } : {}), origin: BASE, "sec-fetch-site": "same-origin" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status >= 300) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
};

const wipe = process.argv.includes("--wipe");
if (wipe) {
  const accounts = await j("GET", "/api/accounts");
  for (const a of accounts.accounts ?? []) await j("DELETE", `/api/accounts/${a.id}`).catch(() => {});
  // DELETE 是软归档（archived=true），流水不级联删——此脚本仅限本地测试环境使用
  console.log("[seed] 已归档全部账户（软删，历史流水保留）");
  process.exit(0);
}

// 1. 账户
const accs = {};
for (const [name, icon, open] of [
  ["微信零钱", "💚", 325420],
  ["招商银行", "🏦", 2840000],
  ["支付宝", "🅰️", 187055],
  ["招行信用卡", "💳", 0],
]) {
  try {
    const { account } = await j("POST", "/api/accounts", { name, icon, openingBalanceCents: open });
    accs[name] = account.id;
  } catch (e) {
    if (String(e).includes("同名")) {
      const list = await j("GET", "/api/accounts");
      accs[name] = list.accounts.find((a) => a.name === name).id;
    } else throw e;
  }
}
console.log("[seed] 账户 ×4:", Object.keys(accs).join("/"));

// 2. 当月 + 上月流水(覆盖餐饮/交通/购物/居住/娱乐/医疗/工资)
const txs = [
  ["out", 2600, "餐饮", "老王", "和老王午饭", 3, "12:30", "微信零钱"],
  ["out", 15800, "购物", "京东", "机械键盘", 6, "21:10", "招行信用卡"],
  ["out", 1200, "交通", "滴滴", "通勤打车", 8, "09:15", "支付宝"],
  ["in", 2600000, "其他", "公司", "9月工资", 10, "10:00", "招商银行"],
  ["out", 45800, "居住", "链家", "房租", 10, "14:00", "招商银行"],
  ["out", 8900, "餐饮", "海底捞", "周末火锅", 13, "19:20", "微信零钱"],
  ["out", 3250, "娱乐", "电影院", "movie night", 13, "21:00", "支付宝"],
  ["out", 128000, "医疗", "口腔医院", "洗牙+补牙", 15, "16:00", "招行信用卡"],
  ["out", 4500, "餐饮", "美团", "外卖", 16, "12:00", "微信零钱"],
  ["out", 99900, "购物", "苹果", "icloud 年费", 18, "08:00", "招行信用卡"],
  ["out", 6600, "餐饮", "公司食堂", "充值", 21, "12:00", "微信零钱"],
  ["out", 230000, "购物", "优衣库", "换季衣物", 22, "15:30", "支付宝"],
];
for (const [direction, amountCents, category, counterparty, note, day, hm, accName] of txs) {
  await j("POST", "/api/transactions", {
    direction, amountCents, category, counterparty, note,
    accountId: accs[accName], occurredAt: at(day, hm),
  });
}
await j("POST", "/api/transactions", { direction: "out", amountCents: 360000, category: "居住", counterparty: "链家", note: "上月房租", accountId: accs["招商银行"], occurredAt: prevAt(10, "14:00") });
await j("POST", "/api/transactions", { direction: "in", amountCents: 2600000, category: "其他", counterparty: "公司", note: "8月工资", accountId: accs["招商银行"], occurredAt: prevAt(10, "10:00") });
await j("POST", "/api/transactions", { direction: "out", amountCents: 189000, category: "购物", counterparty: "淘宝", note: "显示器支架", accountId: accs["支付宝"], occurredAt: prevAt(18, "20:00") });
console.log("[seed] 流水 ×15");

// 3. 预算:月限 8000,阈值 80%
await j("PUT", "/api/budget", { monthlyLimitCents: 800000, alertThreshold: 80 });
console.log("[seed] 预算 8000/月");

// 4. 预算完成；负债与证券交易模块在公开版中已移除
console.log("[seed] 完成 ✓");
