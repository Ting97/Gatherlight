/**
 * 服务端错误映射：ApiError.code（9 值稳定枚举）→ 英文通用文案；
 * 具体业务 message 由服务端返回中文，errorMessage() 在 en 模式优先取 code 映射，
 * 无 code 时回退原始 message（服务端 message 双语化为 P2 范围）。
 */
export const EN: Record<string, string> = {
  "错误：入参不合法": "Invalid input",
  "错误：未登录或会话失效": "Please sign in first",
  "错误：无权限": "Permission denied",
  "错误：资源不存在": "Not found",
  "错误：内容冲突": "Conflict",
  "错误：请求体过大": "Payload too large",
  "错误：配额不足": "Quota exceeded",
  "错误：上游服务异常": "Upstream service error",
  "错误：操作被锁定": "Too many attempts, try later",
};

/** code → 英文文案（zh 调用方不该走到这里；留映射供 errorMessage 用） */
export const CODE_MESSAGES: Record<string, string> = {
  invalid_input: "Invalid input",
  unauthorized: "Please sign in first",
  forbidden: "Permission denied",
  not_found: "Not found",
  conflict: "Conflict",
  payload_too_large: "Payload too large",
  quota: "Quota exceeded",
  upstream: "Upstream service error",
  locked: "Too many attempts, try later",
};

/** 服务端中文原文 → 英文（精确匹配层）：业务 message 的 code 粒度太粗（如 401 既有"未登录"
 * 也有"邮箱或密码不正确"），语义正确的翻译按原文映射；errorMessage 优先查本表 */
export const MESSAGE_EN: Record<string, string> = {
  "邮箱或密码不正确": "Incorrect email or password",
  "该邮箱已注册，请直接登录": "This email is already registered — sign in instead",
  "管理员已存在，请直接登录": "Admin account already exists — sign in instead",
  "验证码错误或已过期": "Verification code is invalid or expired",
  "请填写邮箱验证码": "Enter the email verification code",
  "请填写正确的邮箱地址": "Enter a valid email address",
  "密码需为 8~128 位": "Password must be 8–128 characters",
  "新密码需为 8~128 位": "New password must be 8–128 characters",
  "当前密码不正确": "Current password is incorrect",
  "昵称需为 1~20 个字符": "Nickname must be 1–20 characters",
  "请填写昵称（1-20 个字符）": "Enter a nickname (1–20 characters)",
  "请填写昵称和正确的邮箱": "Enter a nickname and a valid email",
  "初始化失败": "Setup failed",
  "尝试次数过多，请稍后再试": "Too many attempts — try again later",
  "操作过于频繁，请稍后再试": "Too frequent — try again later",
  "邮箱通道未配置，请使用密码登录": "Email delivery is not configured — sign in with password",
  "发送太频繁，请 1 分钟后再试": "Too frequent — try again in 1 minute",
  "今日发送次数已达上限": "Daily sending limit reached",
  "发送失败": "Failed to send",
};
