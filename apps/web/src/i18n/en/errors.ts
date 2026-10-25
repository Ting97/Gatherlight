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
