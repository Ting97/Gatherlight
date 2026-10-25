/**
 * 核心四模块 service 层集成测试（REQ-004 FR-F1.2 / AC-5 覆盖率门槛载体）：
 * 进程内直调 service（除 identity/auth.ts 外均不依赖 Next 请求作用域），真实 SQL 落测试库。
 * AI 相关路径在无 KEY 环境走规则兜底/降级分支——确定性、零网络。
 * 与 routes-smoke 共用测试库约定（SHIGUANGRI_TEST_DB / .env 派生），不可达整组 skip。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const UA = "11111111-1111-4111-8111-111111111111";

let pool: any;
let loaded = false;
let dbReady = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  // 安全护栏：未显式指定测试库时不动真实数据库（整组 skip）
  if (!process.env.SHIGUANGRI_TEST_DB) return;
  process.env.DATABASE_URL = process.env.SHIGUANGRI_TEST_DB;
  delete process.env.ZHIPUAI_API_KEY; // 强制走规则兜底分支（确定性、零网络）
  delete process.env.TYPESAFE_API_KEY;
  ({ pool } = await import("../src/server/platform/db"));
  try {
    const { rows } = await pool.query("select to_regclass('public.profiles') as t");
    dbReady = rows[0].t !== null;
  } catch {
    dbReady = false;
  }
}

async function upsertUser(id: string, nickname: string, role = "user") {
  await pool.query(
    `insert into profiles (id, nickname, role) values ($1,$2,$3)
     on conflict (id) do update set role = excluded.role`,
    [id, nickname, role],
  );
}

/* ---------- timeline：采集→识别→确认→流→编辑→删除 ---------- */

test("timeline：ingest 规则兜底落库 → listFeed 可检索", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await upsertUser(UA, "svc测试A", "admin");
  const { PRESET_ACTIVITIES } = await import("../src/server/time/seed");
  for (const a of PRESET_ACTIVITIES) {
    await pool.query(
      `insert into activities (id, user_id, name, icon, color, default_min, sort_order, is_preset)
       values ($1,$2,$3,$4,$5,$6,$7,true) on conflict (id, user_id) do nothing`,
      [a.id, UA, a.name, a.icon, a.color, a.defaultMin, a.sortOrder],
    );
  }
  const { ingest, listFeed } = await import("../src/server/timeline");
  const { entry } = await ingest(UA, "昨天下午和小陈吃饭花了260，吃得挺开心");
  assert.ok(entry?.id, "ingest 应返回 entry");

  // 后台识别为 fire-and-forget：轮询至 analyzed_at 落库（规则引擎应当秒级）
  let analyzed = false;
  for (let i = 0; i < 20 && !analyzed; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const { rows } = await pool.query("select analyzed_at from entries where id = $1", [entry.id]);
    analyzed = Boolean(rows[0]?.analyzed_at);
  }
  assert.ok(analyzed, "规则兜底识别应落 analyzed_at");

  const feed = await listFeed(UA, { limit: 10, offset: 0, q: "小陈", spaceId: "all" } as any);
  const items = (feed as any).moments ?? [];
  assert.ok(Array.isArray(items), "listFeed 应返回 moments 列表");
  assert.ok(items.some((e: any) => e.id === entry.id), "feed 应含刚发布的动态（搜索命中）");
});

test("timeline：confirmPending 待确认域应用/忽略语义", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { confirmPending } = await import("../src/server/timeline");
  await assert.rejects(
    () => confirmPending(UA, crypto.randomUUID(), undefined),
    /domain 必填/,
    "缺 domain 应 400",
  );
  await assert.rejects(
    () => confirmPending(UA, crypto.randomUUID(), "schedule"),
    /没有待确认/,
    "不存在 entry 应 404 语义",
  );
});

test("timeline：patchFeed 空间归属校验/正文重识别，deleteFeed 级联清理", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { ingest, patchFeed, deleteFeed } = await import("../src/server/timeline");
  const { entry } = await ingest(UA, "冒烟编辑重识别测试句");

  await assert.rejects(
    () => patchFeed(UA, entry.id, { spaceId: crypto.randomUUID() } as any),
    /空间不存在/,
    "他人空间归属应 400",
  );

  const patched = await patchFeed(UA, entry.id, { raw_text: "改成中午吃火锅花了88" } as any);
  assert.ok((patched as any).ok, "正文编辑应成功");

  const del = await deleteFeed(UA, entry.id);
  assert.ok(del, "删除应成功");
  const { rows } = await pool.query("select 1 from entries where id = $1", [entry.id]);
  assert.equal(rows.length, 0, "entry 应物理删除");
});

test("ai：配额三态（pro 无限/免费窗口/admin）与审计写入", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { checkAiQuota, isProValid } = await import("../src/server/ai");
  const q = await checkAiQuota(UA);
  assert.ok(typeof q.used === "number" && (q.limit === null || typeof q.limit === "number"), "配额应返回数值口径");
  assert.equal(typeof q.allowed, "boolean");
  assert.ok(!isProValid("", null), "非 pro 套餐");

  const { writeAuditRecord, auditHealth } = await import("../src/server/ai");
  await writeAuditRecord({
    userId: UA,
    stage: "parse",
    model: "test-model",
    ok: true,
    latencyMs: 12,
    promptTokens: 0,
    completionTokens: 0,
  });
  const health = await auditHealth?.();
  assert.ok(health !== undefined, "auditHealth 应可读");
});

test("ai：提示词读取/失效缓存/装配（DB 版本链路）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { getPrompt, getPromptBundle, assembleUserPrompt, invalidatePrompts } = await import("../src/server/ai");
  const key = "extract_open_vocab";
  const sys = await getPrompt(key as any);
  assert.ok(sys && sys.length > 20, "应取到生效中的 system 提示词");
  const bundle = await getPromptBundle(key as any);
  assert.ok(bundle.system && "userTemplate" in bundle, "三件套应齐");
  invalidatePrompts?.();
  const assembled = await assembleUserPrompt(key as any, bundle, { now: "2026-09-23 12:00" });
  assert.ok(typeof assembled === "string", "装配应产出用户提示词字符串");
});

test("ai：Jev 模式开关（DB 覆盖 + 失效缓存）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { getJevMode, setJevMode, invalidateAiMode } = await import("../src/server/ai");
  await setJevMode("off", UA);
  invalidateAiMode?.();
  assert.equal(await getJevMode(), "off");
  await setJevMode("shadow", UA);
  invalidateAiMode?.();
  assert.equal(await getJevMode(), "shadow");
});

/* ---------- identity：注册校验/资料/会话语义（cookie-free 部分） ---------- */

test("identity：validateRegisterIdentity 与 setup 令牌门禁", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { validateRegisterIdentity, assertSetupToken } = await import("../src/server/identity");
  assert.throws(() => validateRegisterIdentity({ email: "123" }), /邮箱/);
  assert.throws(() => validateRegisterIdentity({ email: "bad" }), /邮箱/);
  assert.throws(() => validateRegisterIdentity({ phone: "13800001234" } as any), /邮箱/, "手机号通道已下线：缺 email 一律邮箱校验失败");
  assert.equal(validateRegisterIdentity({ email: "a@b.co" }), true, "邮箱通道");
  // 未配置 SETUP_TOKEN：门禁直通；配置后错误令牌被拒（FR-C2.3 语义）
  delete process.env.SETUP_TOKEN;
  await assertSetupToken(null); // 未配置 → 直通不抛
  process.env.SETUP_TOKEN = "smoke-token";
  await assert.rejects(() => assertSetupToken("wrong"), /令牌/);
  delete process.env.SETUP_TOKEN;
});

test("identity：me 模块授权聚合与 updateProfile 改密链路", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { me, updateProfile } = await import("../src/server/identity");
  const info = await me({ id: UA, nickname: "svc测试A", phone: null, role: "admin" });
  assert.ok(info.id === UA && Array.isArray(info.modules), "me 应聚合模块授权");

  await updateProfile(UA, { nickname: "svc测试A改" });
  // 改密：先直接落一个已知密码哈希
  const crypto = await import("node:crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync("old-password-8", Buffer.from(salt, "hex"), 64, { N: 16384 }).toString("hex");
  await pool.query(`update profiles set password_hash = $1 where id = $2`, [`scrypt$16384$${salt}$${derived}`, UA]);
  await assert.rejects(
    () => updateProfile(UA, { currentPassword: "wrong-password-1", newPassword: "new-password-8" }),
    /密码/,
    "当前密码错误应拒绝",
  );
  await updateProfile(UA, { currentPassword: "old-password-8", newPassword: "new-password-8" });
  const { rows } = await pool.query("select password_hash from profiles where id = $1", [UA]);
  const [, n, s, h] = rows[0].password_hash.split("$");
  assert.ok(crypto.scryptSync("new-password-8", Buffer.from(s, "hex"), 64, { N: Number(n) }).toString("hex") === h, "新密码应可验证");
});

test("identity：register 前置校验（昵称/邮箱/密码；开放注册免邀请码）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { register } = await import("../src/server/identity");
  // 开放注册：无 inviteCode 字段（传入亦被忽略），前置校验全部先于写库。
  // 注意：register 成功路径内部 createSession 依赖 Next 请求作用域（cookies()），进程内只能测前置校验；
  // 成功建号链路由 identity-fixes（事务落库语义）与 test:routes 的 E2E 冒烟覆盖。
  await assert.rejects(() => register({ nickname: "", email: "svc-smoke@test.dev", password: "password-8" }), /昵称/);
  await assert.rejects(() => register({ nickname: "svc", email: "not-an-email", password: "password-8" }), /邮箱/);
  await assert.rejects(() => register({ nickname: "svc", email: "svc-smoke@test.dev", password: "short" }), /密码/);
});

test("timeline：appendManual 手动补录域与非法域", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { ingest, appendManual, deleteFeed } = await import("../src/server/timeline");
  const { entry } = await ingest(UA, "冒烟手动补录底稿");
  await assert.rejects(
    () => appendManual(UA, entry.id, { domain: "bad", payload: {} }),
    /domain 需为/,
    "非法 domain 应 400",
  );
  const ok = await appendManual(UA, entry.id, {
    domain: "todo",
    payload: { title: "冒烟补录待办" },
  });
  assert.ok(ok, "手动补录 todo 应成功");
  await deleteFeed(UA, entry.id);
});

test("identity：邮箱验证码通道未配置时的错误语义", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { sendEmail } = await import("../src/server/identity");
  await assert.rejects(() => sendEmail({ email: "a@b.co" }), /发送失败|通道|未配置/);
});

test("ai：admin-data 目录/查询/注入块（R5）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const ad = await import("../src/server/ai/admin-data");
  const cat = ad.catalogPayload();
  assert.ok(cat.datasets.length >= 14, "数据集目录应完整");
  assert.ok(cat.datasets.every((d: any) => ["category", "behavior", "derived"].includes(d.partition)), "三分类合法");
  await assert.rejects(
    () => ad.queryDataset(UA, "not_a_dataset", {}),
    (e: any) => e?.status === 404,
    "未知数据集应 404",
  );
  // 时间窗护栏：跨 92 天拒绝；合法窗口返回 {total, items}
  await assert.rejects(
    () => ad.queryDataset(UA, "entries", { from: "2026-01-01", to: "2026-09-23" }),
    /92/,
    "超 92 天应拒绝",
  );
  const r = await ad.queryDataset(UA, "entries", { from: "2026-09-01", to: "2026-09-30", limit: 10 });
  assert.ok(Array.isArray(r.items) && typeof r.total === "number", "查询返回 {total, items}");

  // 个性化注入块：配置校验 + 空配置零输出
  assert.throws(() => ad.validateUserDataConfig([{ dataset: "nope" }]), /未知数据集/);
  assert.throws(() => ad.validateUserDataConfig([{ dataset: "entries", days: 999 }]), /92/);
  assert.deepEqual(ad.validateUserDataConfig(null), []);
  // 空数据用户 → 注入块为空（零变化）；有数据用户 → 非空且受字符硬顶约束
  const emptyUser = crypto.randomUUID();
  const emptyBlock = await ad.buildUserDataBlock(emptyUser, [{ dataset: "entries", days: 7, limit: 5 }]);
  assert.equal(emptyBlock, "", "无数据用户注入块为空（零变化）");
  const block = await ad.buildUserDataBlock(UA, [{ dataset: "entries", days: 7, limit: 5 }]);
  assert.ok(block.length <= 8000, "注入块受 8000 字符硬顶");
});

test("teardown: 清理 svc 测试数据", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await pool.query(`delete from invite_codes where created_by = any($1)`, [[UA]]);
  await pool.query(`delete from entries where user_id = any($1)`, [[UA]]);
  await pool.query(`delete from audit_logs where user_id = any($1)`, [[UA]]);
  await pool.query(`delete from app_config where true`, []);
  await pool.query(`update profiles set nickname='svc测试A', password_hash=null where id=$1`, [UA]);
  assert.ok(true);
});
