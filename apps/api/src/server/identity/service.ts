/**
 * identity 域 service（REQ-004 FR-B1 / 4-C）：登录/注册/会话/资料的业务与事务边界。
 * 迁移自 auth/* 路由（4-B 安全语义保留：登录双层防护、模糊文案、setup 一次性令牌）。
 */
import { ApiError } from "../platform/http/errors";
import { assertLoginAllowed, LoginLockedError, recordLoginAttempt, clientIp } from "../platform/security/login-guard";
import { timingSafeEqual } from "node:crypto";
import { loadConfig } from "@/server/platform/config";
import { createSession, destroySession } from "@/server/identity/auth";
import { verifyPassword, hashPassword, generateInviteCode } from "@/server/identity/auth-crypto";
import { isValidEmail, verifyEmailCode, emailConfigured, sendEmailCode } from "@/server/identity/email";
import { PRESET_ACTIVITIES } from "@/server/time/seed";
import { pool } from "@/server/platform/db";
import { hashToken } from "@/server/identity/auth-crypto";
import { profilesRepo } from "./repo";

/** 登录防护记录失败不影响主流程：悬空 Promise 的 rejection 在 Node ≥15 会崩进程，必须就地兜底 */
const noteAttempt = (identity: string, ip: string, ok: boolean) =>
  recordLoginAttempt(identity, ip, ok).catch((e) =>
    console.warn("[login-guard] 尝试记录失败（忽略）:", String(e).slice(0, 120)),
  );

/**
 * 固定哑 hash（模块加载时生成一次）：账号不存在时也执行同成本 scrypt 验证，
 * 抹平「存在账号走 scrypt、不存在账号直接返回」的响应耗时差（计时 oracle）。
 */
const DUMMY_PASSWORD_HASH = hashPassword("shiguangri-timing-equalizer-dummy");

export interface LoginInput {
  email?: string;
  password?: string;
  emailCode?: string;
  /** 请求派生（限流/审计用） */
  ip: string;
  userAgent?: string | null;
}

/** 登录：邮箱 + 密码/验证码。成功返回 {token,user}；失败抛 ApiError（文案模糊，不暴露账号存在性）。 */
export async function login(input: LoginInput) {
  if (!input.email || !isValidEmail(input.email)) {
    throw ApiError.badRequest("请填写正确的邮箱地址");
  }
  const identity = input.email.trim().toLowerCase();

  try {
    await assertLoginAllowed(identity, input.ip);
  } catch (e) {
    // 只把「登录锁」转 423；DB 抖动等基础设施异常原样上抛（withRoute 收敛为通用 500、
    // 细节只进日志）——旧版把任意异常 message 透进响应体且伪装成「尝试次数过多」（二十轮）
    if (e instanceof LoginLockedError) {
      throw new ApiError(423, "locked", e.message || "尝试次数过多，请稍后再试");
    }
    throw e;
  }

  const { rows } = await profilesRepo.byIdentity(identity);
  const user = rows[0];
  const fuzzyFail = () => ApiError.unauthorized("邮箱或密码不正确");

  if (!user) {
    void noteAttempt(identity, input.ip, false);
    // 验证码登录（无密码）对未注册号也回验证码口径：否则「密码不正确」vs「验证码错误」
    // 两种文案构成账号存在性 oracle（违背本文件「不暴露账号存在性」不变量）
    if (!input.password) throw ApiError.unauthorized("验证码错误或已过期");
    // 计时对齐：账号不存在也跑一次同成本 scrypt 假验证（对固定哑 hash），避免耗时差暴露账号存在性
    verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    throw fuzzyFail();
  }

  if (input.password) {
    // 计时对齐（二十轮）：「有账号但未设密码」旧版直接 fuzzyFail 零成本返回，
    // 与「账号不存在跑满成本 scrypt」构成「已注册未设密码」探测 oracle——补同成本哑验证
    if (!user.password_hash) {
      void noteAttempt(identity, input.ip, false);
      verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      throw fuzzyFail();
    }
    if (!verifyPassword(input.password, user.password_hash)) {
      void noteAttempt(identity, input.ip, false);
      throw fuzzyFail();
    }
  } else {
    // 未验证态不得用专属文案暴露「账号存在且未验证」（违背本文件「不暴露账号存在性」口径），
    // 且必须计入失败尝试：收敛为与验证码错误一致的模糊响应
    if (!user.email_verified) {
      void noteAttempt(identity, input.ip, false);
      throw ApiError.unauthorized("验证码错误或已过期");
    }
    if (!input.emailCode || !(await verifyEmailCode(identity, "login", input.emailCode))) {
      void noteAttempt(identity, input.ip, false);
      throw ApiError.unauthorized("验证码错误或已过期");
    }
  }

  // 禁用账号凭证即使正确也不发会话：与 getCurrentUser 的 active 谓词（auth.ts）同口径，
  // 响应走模糊失败——「密码不正确」而非「账号被禁」，不构成账号状态 oracle
  if (user.status && user.status !== "active") {
    void noteAttempt(identity, input.ip, false);
    throw fuzzyFail();
  }

  await noteAttempt(identity, input.ip, true);
  await profilesRepo.touchLastLogin(user.id);
  const token = await createSession(user.id, input.userAgent ?? undefined);
  return { ok: true as const, token, user: { id: user.id, nickname: user.nickname } };
}

/** 退出当前会话 */
export async function logout() {
  await destroySession();
  return { ok: true as const };
}

/** 全端登出：吊销该用户全部会话（FR-C1.3） */
export async function logoutAll(userId: string) {
  await pool.query(`delete from sessions where user_id = $1`, [userId]);
  await destroySession();
  return { ok: true as const };
}

/** 当前会话信息（me） */
export async function me(user: {
  id: string;
  nickname: string | null;
  phone: string | null;
  role: string;
}) {
  const { rows } = await profilesRepo.info(user.id);
  // 模块开关（028）在 platform：modules=有效 key 全量（存量 includes 判断兼容），modulePrefs=功能管理区明细
  const { resolveUserModules } = await import("@/server/platform/modules");
  const resolved = await resolveUserModules(user);
  return {
    id: user.id,
    nickname: user.nickname,
    phone: user.phone,
    authDisabled: loadConfig().authDisabled,
    isAdmin: user.role === "admin",
    modules: resolved.modules,
    modulePrefs: resolved.prefs,
    phoneVerified: rows[0]?.phone_verified ?? false,
    createdAt: rows[0]?.created_at ?? null,
  };
}

export interface ProfileInput {
  nickname?: string;
  currentPassword?: string;
  newPassword?: string;
}

/** 改昵称/改密码（从未设过密码的账号可免填当前密码）；改密后吊销其余会话（keepToken=当前会话 token） */
export async function updateProfile(userId: string, body: ProfileInput, opts?: { keepToken?: string | null }) {
  const wantsNickname = body.nickname !== undefined;
  const wantsPassword = body.newPassword !== undefined;
  let nickname: string | undefined;
  let message: string | undefined;

  // 全部校验（含 scrypt 验证）前置到任何写库之前：旧版昵称先落库、密码校验在后，
  // 当前密码输错时昵称已改（部分成功），用户误以为改密成功
  if (wantsNickname) {
    nickname = body.nickname!.trim();
    if (!nickname || nickname.length > 20) {
      throw ApiError.badRequest("昵称需为 1~20 个字符");
    }
  }
  let newHash: string | undefined;
  if (wantsPassword) {
    // 上限 128：多 MB 密码串直进 scryptSync（N=16384，16MB 内存/次）可被认证用户反复触发
    if (body.newPassword!.length < 8 || body.newPassword!.length > 128) {
      throw ApiError.badRequest("新密码需为 8~128 位");
    }
    const stored = await profilesRepo.passwordHashOf(userId);
    if (stored && (!body.currentPassword || !verifyPassword(body.currentPassword, stored))) {
      // 400 而非 401：请求会话本身有效，这是入参校验失败——401 会被 web 端全局
      // 会话失效处理清 token 并整页跳登录（实测把用户从「我的」页踢出去丢表单）
      throw ApiError.badRequest("当前密码不正确");
    }
    newHash = hashPassword(body.newPassword!);
  }

  // 校验全过才写库；昵称/改密/吊销其余会话包进单事务——独立自动提交会在
  // 改密 SQL 或吊销失败时留下「昵称已改密码未改/旧会话未吊销」的半完成态
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (nickname !== undefined) await client.query(`update profiles set nickname = $1 where id = $2`, [nickname, userId]);
    if (newHash !== undefined) await client.query(`update profiles set password_hash = $1 where id = $2`, [newHash, userId]);
    if (newHash !== undefined) {
      // 改密后吊销其余会话（保留当前会话）：被盗号后受害者改密，攻击者既有 Bearer/cookie
      // 若不清理仍可存活最长 30 天。token 缺失（理论上不会：双通道必有一个）时退化为全吊销。
      const keep = opts?.keepToken ?? null;
      if (keep) await client.query(`delete from sessions where user_id = $1 and token_hash <> $2`, [userId, hashToken(keep)]);
      else await client.query(`delete from sessions where user_id = $1`, [userId]);
      message = "密码已更新";
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return { ok: true as const, nickname, message };
}

/** 注册（开放注册，邮箱身份）：完整实现保留在路由编排（含通道验证/预设播种），此处做参数校验面 */
export function validateRegisterIdentity(input: { email?: string }) {
  if (!input.email || !isValidEmail(input.email)) {
    throw ApiError.badRequest("请填写正确的邮箱地址");
  }
  return true;
}

/**
 * setup 一次性令牌校验（FR-C2.3）：配置了 SETUP_TOKEN 即强制。
 * 只校验不消费（消费由 setup 在最后一个可能失败的写步骤成功后显式调用）；
 * 输错不烧令牌——否则一次手滑就永久作废，只能改 env 重置。
 */
export async function assertSetupToken(tokenHeader: string | null) {
  const expect = loadConfig().setupToken;
  if (!expect) return;
  const { rows: used } = await pool.query(`select value from app_config where key = 'setup_token_used'`, []);
  if (used[0]) throw new ApiError(410, "conflict", "初始化令牌已失效");
  const a = Buffer.from(tokenHeader ?? "");
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(403, "forbidden", "初始化令牌不正确");
  }
}

/** 消费一次性令牌：insert returning 判定成败——旧版 on conflict do nothing 不看结果，
 * 并发两个持有效令牌的请求都能通过 assertSetupToken 各自建号 */
async function consumeSetupToken() {
  const { rows } = await pool.query(
    `insert into app_config (key, value) values ('setup_token_used', to_jsonb(now()))
     on conflict (key) do nothing returning key`,
    [],
  );
  if (!rows[0]) throw new ApiError(410, "conflict", "初始化令牌已失效");
}

/** 初始化管理员（一次性令牌校验 + 抢占防护） */
export async function setup(input: { nickname?: string; email?: string; password?: string }, tokenHeader: string | null, userAgent?: string | null) {
  // 先完成全部入参/前置校验，最后一步才消费一次性令牌（否则畸形请求也会烧掉令牌）
  if (!input.nickname?.trim() || !input.email || !isValidEmail(input.email)) {
    throw ApiError.badRequest("请填写昵称和正确的邮箱");
  }
  // 上限与 login/register/updateProfile 同口径（128）：scryptSync 大密码放大内存面（本文件 ：179 注释）
  if (!input.password || input.password.length < 8 || input.password.length > 128) {
    throw ApiError.badRequest("密码需为 8~128 位");
  }
  const existing = await profilesRepo.hasEmailAccount();
  if (existing.rows.length > 0) {
    throw ApiError.forbidden("管理员已存在，请直接登录");
  }
  // 硬守卫：已存在带密码的管理员（种子行已被认领 / 已被授予管理员）一律拒绝——
  // 旧守卫以「任一账号有手机号」代理初始化状态，全邮箱注册的库会放行 setup，
  // 成为未认证的管理员创建入口（十六轮 GUI 实测踩中）
  if ((await profilesRepo.hasAdminAccount()).rows.length > 0) {
    throw ApiError.forbidden("管理员已存在，请直接登录");
  }
  await assertSetupToken(tokenHeader);
  // 先完成最后一个可能失败的写步骤，成功后才消费一次性令牌：
  // 旧序 consume 在 claimDevAdmin 之前，种子行缺失（update 0 行）报「初始化失败」时令牌已被烧掉
  // （认领语句带 email is null 条件：两个并发 setup 双双通过上方守卫时，只有一个能认领成功）
  const { rows } = await profilesRepo.claimDevAdmin(input.nickname.trim(), input.email.trim().toLowerCase(), hashPassword(input.password));
  if (!rows[0]) throw ApiError.upstream("初始化失败");
  await consumeSetupToken();
  const token = await createSession(rows[0].id, userAgent ?? undefined);
  return { ok: true as const, token, user: rows[0] };
}

export { hashPassword, clientIp };

/** 邀请码管理实现（GET/POST 由 /api/admin/invites 与旧地址 /api/auth/invites 共用，防双份漂移） */
export async function listInvites() {
  const { rows } = await pool.query(
    `select i.code, i.used_by, i.expires_at, i.created_at, p.nickname as used_by_name
     from invite_codes i left join profiles p on p.id = i.used_by
     order by i.created_at desc limit 50`,
  );
  return rows;
}

export async function createInvite(userId: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw ApiError.badRequest("days 需为 1~365 的整数");
  }
  const code = generateInviteCode();
  const expires = new Date(Date.now() + days * 86_400_000);
  const { rows } = await pool.query(
    `insert into invite_codes (code, created_by, expires_at) values ($1,$2,$3) returning code, expires_at`,
    [code, userId, expires],
  );
  return rows[0];
}

export interface RegisterInput {
  email?: string;
  password?: string;
  emailCode?: string;
  nickname?: string;
  userAgent?: string | null;
}

/** 注册（开放注册，邮箱身份）：免邀请码——注册事务内自动生成一枚邀请码绑定到新用户，
 *  保持 invite_codes 对每个注册用户的记录链（审计可见）。通道已配置时须邮箱验证码。 */
export async function register(input: RegisterInput) {
  const { nickname: nicknameRaw } = input;
  const nickname = nicknameRaw?.trim();
  if (!nickname || nickname.length > 20) throw ApiError.badRequest("请填写昵称（1-20 个字符）");
  validateRegisterIdentity(input);
  if (!input.password || input.password.length < 8 || input.password.length > 128)
    throw ApiError.badRequest("密码需为 8~128 位");

  const emailNorm = input.email!.trim().toLowerCase();
  const dup = await pool.query(`select email from profiles where email = $1`, [emailNorm]);
  if (dup.rows.length > 0) {
    throw ApiError.badRequest("该邮箱已注册，请直接登录");
  }

  let emailVerified = false;
  if (emailConfigured()) {
    if (!input.emailCode) throw ApiError.badRequest("请填写邮箱验证码");
    if (!(await verifyEmailCode(emailNorm, "login", input.emailCode))) {
      throw ApiError.badRequest("验证码错误或已过期");
    }
    emailVerified = true;
  }

  // 事务（4-F P1）：建号 + 邀请码自动绑定 + 预设播种 原子完成，中途失败整体回滚不留半成品
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into profiles (nickname, email, email_verified, password_hash, last_login_at)
       values ($1, $2, $3, $4, now()) returning id, nickname`,
      [nickname, emailNorm, emailVerified, hashPassword(input.password)],
    );
    const user = rows[0];
    // 开放注册的邀请码记录：自生成自绑定（created_by=used_by=新用户），admin 后台邀请码列表可追溯每个注册
    await client.query(
      `insert into invite_codes (code, created_by, used_by, used_at) values ($1, $2, $2, now())`,
      [generateInviteCode(), user.id],
    );
    // 九大预设分类：新用户开箱即用（与 seed.ts 同构；须在本事务同连接执行，
    // 走独立连接会因 FK 等待未提交的建号行而挂起）
    for (const a of PRESET_ACTIVITIES) {
      await client.query(
        `insert into activities (id, user_id, name, icon, color, default_min, sort_order, is_preset)
         values ($1, $2, $3, $4, $5, $6, $7, true)
         on conflict (id, user_id) do nothing`,
        [a.id, user.id, a.name, a.icon, a.color, a.defaultMin, a.sortOrder],
      );
    }
    await client.query("commit");
    const token = await createSession(user.id, input.userAgent ?? undefined);
    return { ok: true as const, token, user };
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      // 连接已不可用：释放即可
    }
    // 并发注册同一邮箱：快查双双通过后唯一约束兜底，转友好提示而非 500
    if ((e as { code?: string }).code === "23505") {
      throw ApiError.conflict("该邮箱已注册，请直接登录");
    }
    throw e;
  } finally {
    client.release();
  }
}

/** 发送邮箱验证码（lang 跟随界面语言：邮件主题/正文双语模板） */
export async function sendEmail(input: { email?: string; purpose?: string }, lang: "zh" | "en" = "zh") {
  if (!input.email || !isValidEmail(input.email)) throw ApiError.badRequest("请填写正确的邮箱地址");
  const purpose = input.purpose === "bind" ? "bind" : "login";
  const r = await sendEmailCode(input.email.trim().toLowerCase(), purpose, lang);
  if (!r.ok) throw new ApiError(r.status, "upstream", r.error ?? "发送失败");
  return { ok: true as const };
}

