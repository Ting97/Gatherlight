import { NextResponse } from "next/server";
import { pool } from "@/server/platform/db";
import { withAdmin, readJsonCapped } from "@/server/platform/http/route";
import { activateProvider, ensureProviderApplied, envFallbackSummary, validateProviderInput, type ProviderInput } from "@/server/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maskKey = (k: string) => (k.length > 8 ? `••••${k.slice(-4)}` : "••••");

/** GET /api/admin/ai-providers —— 档案清单（key 掩码）+ 环境变量兜底摘要 */
export const GET = withAdmin(async () => {
  await ensureProviderApplied();
  const { rows } = await pool.query(
    `select id, label, base_url, api_key, model, vision_model, is_active, updated_at
     from ai_provider_profiles order by created_at`,
  );
  return NextResponse.json({
    profiles: rows.map((r) => ({
      id: r.id,
      label: r.label,
      baseUrl: r.base_url,
      model: r.model,
      visionModel: r.vision_model,
      keyMasked: maskKey(r.api_key as string),
      active: r.is_active,
      updatedAt: r.updated_at,
    })),
    env: envFallbackSummary(),
    envActive: !rows.some((r) => r.is_active),
  });
});

/** POST /api/admin/ai-providers —— 新建档案（activate=true 立即激活） */
export const POST = withAdmin(async (req) => {
  await ensureProviderApplied();
  const body = (await readJsonCapped(req) as any) as ProviderInput;
  const v = validateProviderInput(body, true);
  const { rows } = await pool.query(
    `insert into ai_provider_profiles (label, base_url, api_key, model, vision_model)
     values ($1,$2,$3,$4,$5) returning id, label`,
    [v.label, v.baseUrl, v.apiKey, v.model, v.visionModel],
  );
  if (body.activate) await activateProvider(rows[0].id);
  return NextResponse.json({ ok: true, id: rows[0].id, label: rows[0].label });
});
