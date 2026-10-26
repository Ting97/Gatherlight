/**
 * 模型接入运行时（071 BYOK）：管理后台可配置多个 OpenAI 兼容服务商并激活切换。
 * 原理：packages/ai 在每次调用时读 process.env（ZHIPUAI_BASE_URL/API_KEY/GLM_MODEL/GLM_VISION_MODEL），
 * 本模块在激活/切回时改写这四个 env（首次改写前快照原始值）；无激活档案 = 环境变量兜底，
 * 与既有部署（env 配 Nebius Token Factory）完全兼容。
 * 安全：api_key 只存库、只在服务端内存/env 中流转——禁止进日志与任何 API 响应（GET 层掩码）。
 */
import { pool } from "@/server/platform/db";
import { ApiError } from "@/server/platform/http/errors";

export interface ProviderProfile {
  id: string;
  label: string;
  base_url: string;
  api_key: string;
  model: string;
  vision_model: string | null;
  is_active: boolean;
}

/** 档案入参（create 全必填；update 时 apiKey 省略 = 保留旧值） */
export interface ProviderInput {
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  visionModel?: string | null;
  activate?: boolean;
}

export function validateProviderInput(v: ProviderInput, requireAll: boolean): { label: string; baseUrl: string; apiKey?: string; model: string; visionModel: string | null } {
  const label = (v.label ?? "").trim();
  const baseUrl = (v.baseUrl ?? "").trim();
  const model = (v.model ?? "").trim();
  const visionModel = (v.visionModel ?? null)?.toString().trim() || null;
  if (requireAll || v.label !== undefined) {
    if (!label || label.length > 40) throw ApiError.badRequest("名称需为 1~40 个字符");
  }
  if (requireAll || v.baseUrl !== undefined) {
    if (!/^https:\/\/.+/.test(baseUrl) || baseUrl.length > 300) throw ApiError.badRequest("Base URL 需以 https:// 开头（OpenAI 兼容端点，含 /v1）");
  }
  if (requireAll || v.model !== undefined) {
    if (!model || model.length > 100) throw ApiError.badRequest("模型 ID 需为 1~100 个字符");
  }
  if (visionModel && visionModel.length > 100) throw ApiError.badRequest("视觉模型 ID 过长（≤100 字符）");
  if (v.apiKey !== undefined && v.apiKey !== "") {
    if (v.apiKey.length < 8 || v.apiKey.length > 500) throw ApiError.badRequest("API key 长度需为 8~500 字符");
  } else if (requireAll) {
    throw ApiError.badRequest("API key 不能为空");
  }
  return { label, baseUrl, apiKey: v.apiKey || undefined, model, visionModel };
}

/** 运行时改写的 env 键（packages/ai 的凭据读取面） */
const ENV_KEYS = ["ZHIPUAI_BASE_URL", "ZHIPUAI_API_KEY", "GLM_MODEL", "GLM_VISION_MODEL"] as const;

interface EnvSnapshot {
  [k: string]: string | undefined;
}
const g = globalThis as unknown as { __aiProviderEnvSnapshot?: EnvSnapshot; __aiProviderApplied?: Promise<void> };

function snapshotEnv(): EnvSnapshot {
  if (!g.__aiProviderEnvSnapshot) {
    g.__aiProviderEnvSnapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  }
  return g.__aiProviderEnvSnapshot;
}

/** 把档案应用到 env（进程内全量生效——所有 chunk 的 packages/ai 调用点同进程共享） */
export function applyProviderToEnv(p: Pick<ProviderProfile, "base_url" | "api_key" | "model" | "vision_model"> | null): void {
  snapshotEnv();
  if (p) {
    process.env.ZHIPUAI_BASE_URL = p.base_url;
    process.env.ZHIPUAI_API_KEY = p.api_key;
    process.env.GLM_MODEL = p.model;
    if (p.vision_model) process.env.GLM_VISION_MODEL = p.vision_model;
    else process.env.GLM_VISION_MODEL = g.__aiProviderEnvSnapshot!.GLM_VISION_MODEL;
  } else {
    for (const k of ENV_KEYS) {
      const v = g.__aiProviderEnvSnapshot![k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** 当前激活档案（无 = null，走环境变量） */
export async function loadActiveProvider(): Promise<ProviderProfile | null> {
  try {
    const { rows } = await pool.query(
      `select id, label, base_url, api_key, model, vision_model, is_active
       from ai_provider_profiles where is_active limit 1`,
    );
    return (rows[0] as ProviderProfile) ?? null;
  } catch {
    // 表未建（迁移未跑）等服务端异常：回落 env，不阻断 AI 通道
    return null;
  }
}

/** 环境变量兜底档案摘要（启动快照：切回「环境变量」时实际生效的值；key 只报有无不报内容） */
export function envFallbackSummary(): { model: string; baseUrl: string; hasKey: boolean; visionModel: string | null } {
  const s = snapshotEnv();
  return {
    model: s.GLM_MODEL ?? "glm-4-flash",
    baseUrl: s.ZHIPUAI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    hasKey: Boolean(s.ZHIPUAI_API_KEY),
    visionModel: s.GLM_VISION_MODEL ?? null,
  };
}

/** 进程启动（各 bundle chunk 首次 import）时应用激活档案；globalThis 守卫保证整进程只执行一次 */
export function ensureProviderApplied(): Promise<void> {
  if (!g.__aiProviderApplied) {
    g.__aiProviderApplied = loadActiveProvider().then((p) => {
      if (p) applyProviderToEnv(p);
    });
  }
  return g.__aiProviderApplied;
}

/** 激活档案（id=null 切回环境变量）。事务内互斥置位后应用 env，返回生效档案摘要 */
export async function activateProvider(id: string | null): Promise<ProviderProfile | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`update ai_provider_profiles set is_active = false where is_active`);
    let row: ProviderProfile | null = null;
    if (id) {
      const { rows } = await client.query(
        `update ai_provider_profiles set is_active = true, updated_at = now() where id = $1
         returning id, label, base_url, api_key, model, vision_model, is_active`,
        [id],
      );
      row = (rows[0] as ProviderProfile) ?? null;
      if (!row) throw new Error("profile not found");
    }
    await client.query("commit");
    applyProviderToEnv(row);
    return row;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
