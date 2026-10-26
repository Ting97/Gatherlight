import { NextResponse } from "next/server";
import { pool } from "@/server/platform/db";
import { withAdminParams, readJsonCapped } from "@/server/platform/http/route";
import { ApiError } from "@/server/platform/http/errors";
import { activateProvider, applyProviderToEnv, ensureProviderApplied, validateProviderInput, type ProviderInput } from "@/server/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/admin/ai-providers/[id] —— 更新档案（apiKey 省略 = 保留旧值；activate=true 立即激活） */
export const PUT = withAdminParams(async (req, { params }) => {
  await ensureProviderApplied();
  const { id } = await params;
  const body = (await readJsonCapped(req) as any) as ProviderInput;
  const v = validateProviderInput(body, false);
  const prev = (await pool.query(`select id, base_url, api_key, model, vision_model, label from ai_provider_profiles where id = $1`, [id])).rows[0];
  if (!prev) throw ApiError.notFound("档案不存在");
  await pool.query(
    `update ai_provider_profiles set
       label = $2, base_url = $3, model = $4, vision_model = $5,
       api_key = coalesce($6, api_key), updated_at = now()
     where id = $1`,
    [id, v.label || prev.label, v.baseUrl || prev.base_url, v.model || prev.model, v.visionModel, v.apiKey ?? null],
  );
  // 更新的若正处激活态：新值即时生效（env 重放）
  const active = (await pool.query(`select is_active from ai_provider_profiles where id = $1`, [id])).rows[0];
  if (body.activate) {
    await activateProvider(id);
  } else if (active?.is_active) {
    const fresh = (await pool.query(`select base_url, api_key, model, vision_model from ai_provider_profiles where id = $1`, [id])).rows[0];
    applyProviderToEnv(fresh);
  }
  return NextResponse.json({ ok: true });
});

/** DELETE /api/admin/ai-providers/[id] —— 删除档案；删的是激活档案时自动切回环境变量 */
export const DELETE = withAdminParams(async (_req, { params }) => {
  await ensureProviderApplied();
  const { id } = await params;
  const row = (await pool.query(`select is_active from ai_provider_profiles where id = $1`, [id])).rows[0];
  if (!row) throw ApiError.notFound("档案不存在");
  await pool.query(`delete from ai_provider_profiles where id = $1`, [id]);
  if (row.is_active) await activateProvider(null);
  return NextResponse.json({ ok: true });
});
