"use client";

/**
 * Web 数据层唯一入口（REQ-004 FR-E1.1/E1.2 收口）：
 * - 转发三端共享 client-api 的 api()/apiForm()，行为与旧裸 fetch 完全兼容（同域 cookie）
 * - 401 单点跳转：会话失效统一回 /login（登录/初始化页除外——其自身调用 401 是正常业务语义）
 * - 统一注入 X-Lang（AI 输出语言跟随界面语言）与错误 message 的 code 级翻译
 * - 调用方按状态码分支时捕获 ApiClientError 检查 e.status（如 409 冲突）
 */
import { api as baseApi, apiForm as baseApiForm, apiBase as baseApiBase, ApiClientError } from "@shiguangri/shared/client-api";
import { getLang } from "@/i18n";
import { CODE_MESSAGES, MESSAGE_EN } from "@/i18n/en/errors";

const NO_REDIRECT_PATHS = ["/login", "/setup"];
export { NO_REDIRECT_PATHS };

/** 错误文案翻译：en 模式先按服务端原文精确映射（语义正确），再按稳定 code 映射，
 * 均未命中回退服务端原始 message（中文） */
export function errorMessage(e: unknown, fallback = "操作失败"): string {
  if (e instanceof ApiClientError) {
    if (getLang() === "en") {
      if (MESSAGE_EN[e.message]) return MESSAGE_EN[e.message];
      if (e.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code];
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e ?? fallback);
}

async function with401Redirect<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (
      e instanceof ApiClientError &&
      e.status === 401 &&
      typeof window !== "undefined" &&
      !NO_REDIRECT_PATHS.includes(window.location.pathname)
    ) {
      window.location.href = "/login";
    }
    throw e;
  }
}

export function api<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  return with401Redirect(() =>
    baseApi<T>(url, method, body, { "x-lang": getLang(), ...headers }, opts),
  );
}

export function apiForm<T = any>(url: string, form: FormData, method = "POST"): Promise<T> {
  return with401Redirect(() => baseApiForm<T>(url, form, method, { "x-lang": getLang() }));
}

export { ApiClientError };

/** API 基址（数据导出 <a href> 直链等 fetch 之外入口用） */
export const apiBase = baseApiBase;
