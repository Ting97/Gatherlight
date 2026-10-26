import { NextResponse } from "next/server";
import { withAdmin, readJsonCapped } from "@/server/platform/http/route";
import { ApiError } from "@/server/platform/http/errors";
import { activateProvider, ensureProviderApplied } from "@/server/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/admin/ai-providers/activate {id|null} —— 激活档案；id=null 切回环境变量兜底 */
export const PUT = withAdmin(async (req) => {
  await ensureProviderApplied();
  const { id } = (await readJsonCapped(req) as any) as { id?: string | null };
  if (id !== null && (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw ApiError.badRequest("id 需为合法档案 id 或 null");
  }
  const applied = await activateProvider(id ?? null);
  return NextResponse.json({
    ok: true,
    active: applied ? { id: applied.id, label: applied.label, model: applied.model } : null,
    usingEnv: !applied,
  });
});
