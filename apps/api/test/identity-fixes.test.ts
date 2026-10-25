/**
 * identity 域修复回归（4-F，邮箱身份契约）：
 * P1 开放注册（免邀请码）：建号 + 事务内自动生成邀请码绑定新用户（created_by=used_by=新用户）+ 预设播种原子落库；重复邮箱拒绝。
 * P2 verifyCode 一次性原子核销（邮箱链路）：重放/并发核销、purpose 隔离、通道未配置降级。
 * 与 services-smoke 同约定：SHIGUANGRI_TEST_DB 显式指定才动库（不可达整组 skip）；
 * 测试用户/数据用 22260000-… UUID 与 fix2226xxxx@test.dev 专名邮箱前缀，幂等清理，可并发重跑。
 * 注意：register 成功路径末尾 createSession 依赖 Next 请求作用域（cookies()），进程内直调
 * 会在「事务已提交后」抛非 ApiError——本文件据此验证提交语义，不视其为失败。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const UA = "22260000-1111-4111-8111-111111111111";

let pool: any;
let loaded = false;
let dbReady = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  // 安全护栏：未显式指定测试库时不动真实数据库（整组 skip）
  if (!process.env.SHIGUANGRI_TEST_DB) return;
  process.env.DATABASE_URL = process.env.SHIGUANGRI_TEST_DB;
  // 邮箱验证码通道/初始化令牌一律未配置：开放注册走免验证码确定性分支（零网络；config getter 实时读，删 env 即降级）
  for (const k of [
    "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT", "EMAIL_SMTP_USER", "EMAIL_SMTP_PASS", "EMAIL_FROM",
    "SETUP_TOKEN",
  ]) delete process.env[k];
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

/** 幂等清理本文件全部测试数据（profiles 级联 sessions/activities；invite_codes 无级联，须先按测试用户清） */
async function cleanup() {
  const testUsers = `select id from profiles where email like '%fix2226%' or id = $1 or id::text like '22260000-2226-4226-8226-2226000011%'`;
  await pool.query(
    `delete from invite_codes where created_by in (${testUsers}) or used_by in (${testUsers})`,
    [UA],
  );
  await pool.query(`delete from email_codes where email like '%fix2226%'`, []);
  await pool.query(`delete from profiles where email like '%fix2226%' or id = $1 or id::text like '22260000-2226-4226-8226-2226000011%'`, [UA]);
}

/* ---------- P1：开放注册（免邀请码）建号 + 自动邀请码 + 重复邮箱拒绝 ---------- */

test("identity-fix：开放注册免邀请码建号 + 自动绑定邀请码 + 播种随事务落库", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await cleanup();
  const { register } = await import("../src/server/identity");

  // 免邀请码注册：事务提交后 createSession 因无请求作用域抛非 ApiError（预期内），建号/自动邀请码/播种已原子落库
  await assert.rejects(
    () => register({ nickname: "fix一号", email: "fix22260001@test.dev", password: "password-8" }),
    (e: any) => e?.name !== "ApiError",
    "免邀请码注册不应在业务校验环节失败",
  );
  const p1 = await pool.query(`select id from profiles where email = 'fix22260001@test.dev'`);
  assert.equal(p1.rows.length, 1, "免邀请码注册应建号");
  const uid = p1.rows[0].id;
  const acts = await pool.query(`select count(*)::int as n from activities where user_id = $1`, [uid]);
  assert.equal(acts.rows[0].n, 9, "九大预设分类应随同一事务播种");
  // 注册事务自动生成一枚邀请码绑定新用户（created_by=used_by=新用户 id，admin 后台可追溯每个注册）
  const inv = await pool.query(`select created_by, used_by from invite_codes where used_by = $1`, [uid]);
  assert.equal(inv.rows.length, 1, "应自动生成恰好一枚邀请码");
  assert.equal(inv.rows[0].created_by, uid, "自动邀请码 created_by 应为新用户自身");

  // 同邮箱重复注册 → 前置快查拦截，且不得再建号
  await assert.rejects(
    () => register({ nickname: "fix一号重复", email: "fix22260001@test.dev", password: "password-8" }),
    (e: any) => e?.name === "ApiError" && /该邮箱已注册/.test(String(e?.message)),
    "重复邮箱注册应 400",
  );
  const again = await pool.query(`select count(*)::int as n from profiles where email = 'fix22260001@test.dev'`);
  assert.equal(again.rows[0].n, 1, "重复注册不得再建号");
});

test("identity-fix：并发开放注册各自建号、自动邀请码互不串号", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await cleanup();
  const { register } = await import("../src/server/identity");

  // 双端并发注册（不同邮箱）：开放注册无共享凭证，两端应各自完整落库
  const settled = await Promise.allSettled([
    register({ nickname: "fix并发甲", email: "fix22260003@test.dev", password: "password-8" }),
    register({ nickname: "fix并发乙", email: "fix22260004@test.dev", password: "password-8" }),
  ]);
  const reasons = settled.map((r) => (r.status === "rejected" ? r.reason : null));
  for (const e of reasons) {
    assert.ok(e, "进程内直调必在 createSession 处抛（请求作用域）");
    assert.notEqual(e?.name, "ApiError", "并发注册不应在业务校验环节失败");
  }

  const p3 = await pool.query(`select id from profiles where email = 'fix22260003@test.dev'`);
  const p4 = await pool.query(`select id from profiles where email = 'fix22260004@test.dev'`);
  assert.equal(p3.rows.length, 1, "并发端甲应建号");
  assert.equal(p4.rows.length, 1, "并发端乙应建号");
  for (const p of [p3, p4]) {
    const inv = await pool.query(`select created_by, used_by from invite_codes where used_by = $1`, [p.rows[0].id]);
    assert.equal(inv.rows.length, 1, "各自应自动生成恰好一枚邀请码");
    assert.equal(inv.rows[0].created_by, p.rows[0].id, "自动邀请码绑定各自注册用户");
  }
});

/* ---------- P2：verifyCode 一次性原子核销（邮箱链路） ---------- */

test("identity-fix：verifyEmailCode 一次性语义（重放拒绝 + purpose 隔离）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  const { verifyEmailCode } = await import("../src/server/identity/email");
  const { hashToken } = await import("../src/server/identity/auth-crypto");
  const email = "user-fix2226@test.local";
  await pool.query(`delete from email_codes where email = $1`, [email]);
  await pool.query(
    `insert into email_codes (email, code_hash, purpose, expires_at) values ($1,$2,'login',$3)`,
    [email, hashToken("654321"), new Date(Date.now() + 600_000)],
  );
  // purpose 不同 → 互不可用（用途隔离）
  assert.equal(await verifyEmailCode(email, "bind", "654321"), false, "bind 用途不应命中 login 验证码");
  assert.equal(await verifyEmailCode(email, "login", "654321"), true, "login 用途应通过");
  assert.equal(await verifyEmailCode(email, "login", "654321"), false, "通过后重放应失败（一次性）");
  const left = await pool.query(`select id from email_codes where email = $1`, [email]);
  assert.equal(left.rows.length, 0, "核销后不留残留行");

  // 通道未配置降级语义保持：configured() = config 通道字段非空（本测试环境删尽了 SMTP env）
  const { emailConfigured } = await import("../src/server/identity/email");
  assert.equal(emailConfigured(), false, "无 EMAIL_SMTP_* 时邮箱通道应降级为未配置");
});

/* ---------- 十六轮：setup 守卫加固 + 改密 401→400 语义 ---------- */

test("identity-r16：setup 在已初始化的库上一律 403（带密码管理员硬守卫）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await cleanup();
  await upsertUser(UA, "fix测试A");
  const identity: any = await import("../src/server/identity");
  // 带密码的管理员在场（hasAdminAccount 新守卫的目标形态；本测试库可能另有邮箱账号，双守卫任一命中皆应拒）
  await pool.query(
    `insert into profiles (id, nickname, role, password_hash) values ($1,'fix管理员R16','admin',$2)
     on conflict (id) do update set role='admin', password_hash=excluded.password_hash`,
    ["22260000-2226-4226-8226-222600001166", identity.hashPassword("password-8")],
  );
  await assert.rejects(
    () => identity.setup({ nickname: "r16偷渡者", email: "fix22260009@test.dev", password: "password-8" }, null),
    (e: any) => e?.name === "ApiError" && e?.status === 403 && /管理员已存在/.test(String(e?.message)),
    "已存在带密码管理员时 setup 应 403 且不得认领/建号",
  );
  const leaked = await pool.query(`select id from profiles where email = 'fix22260009@test.dev'`);
  assert.equal(leaked.rows.length, 0, "被拒 setup 不得留下半成品");
  // hasAdminAccount 单元：上面插入的带密码 admin 应被识别（旧守卫只看手机号，全邮箱库会漏）
  const { profilesRepo } = await import("../src/server/identity/repo");
  assert.ok((await profilesRepo.hasAdminAccount()).rows.length > 0, "hasAdminAccount 应命中带密码的管理员");
});

test("identity-r16：updateProfile 当前密码错误 → 400（业务校验）而非 401（会话失效）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await cleanup();
  await upsertUser(UA, "fix测试A");
  const identity: any = await import("../src/server/identity");
  const uid = "22260000-2226-4226-8226-222600001167";
  await pool.query(
    `insert into profiles (id, nickname, password_hash) values ($1,'fix改密A',$2)
     on conflict (id) do update set password_hash=excluded.password_hash`,
    [uid, identity.hashPassword("old-pass-8")],
  );
  // 错误当前密码：400 + 中文文案（401 会被 web 端全局会话失效处理清 token 并整页跳登录——十六轮 GUI 实测）
  await assert.rejects(
    () => identity.updateProfile(uid, { currentPassword: "wrong-pass", newPassword: "new-pass-8" }),
    (e: any) => e?.name === "ApiError" && e?.status === 400 && /当前密码不正确/.test(String(e?.message)),
    "当前密码错误应 400",
  );
  // 正确当前密码 → 200 语义（返回 ok）且新密码生效
  const r = await identity.updateProfile(uid, { currentPassword: "old-pass-8", newPassword: "new-pass-8" });
  assert.ok(r?.ok, "正确当前密码应改密成功");
});

/* ---------- teardown ---------- */

test("teardown: 清理 identity-fix 测试数据", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await cleanup();
  assert.ok(true);
});
