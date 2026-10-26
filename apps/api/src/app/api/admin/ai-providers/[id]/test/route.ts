import { NextResponse } from "next/server";
import { pool } from "@/server/platform/db";
import { withAdminParams } from "@/server/platform/http/route";
import { ApiError } from "@/server/platform/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai-providers/[id]/test —— 连通性测试。
 * 用档案自身凭据直连一次 chat/completions（max_tokens 压到最小）；
 * 不经 packages/ai 的 env 通道——测试期间不影响线上在用模型。
 * 错误信息只保留状态码与上游短语，key 绝不外泄。
 */
export const POST = withAdminParams(async (_req, { params }) => {
  const { id } = await params;
  const row = (
    await pool.query(`select label, base_url, api_key, model from ai_provider_profiles where id = $1`, [id])
  ).rows[0];
  if (!row) throw ApiError.notFound("档案不存在");

  const base = (row.base_url as string).replace(/\/+$/, "");
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
      body: JSON.stringify({
        model: row.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        stream: false,
      }),
      signal: ctl.signal,
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const bodyText = (await res.text().catch(() => "")).slice(0, 200);
      return NextResponse.json({
        ok: false,
        latencyMs,
        status: res.status,
        error: `HTTP ${res.status}${bodyText ? ` · ${bodyText.replace(/\s+/g, " ").slice(0, 120)}` : ""}`,
      });
    }
    await res.text(); // 消费 body（只需确认 200 与可达）
    return NextResponse.json({ ok: true, latencyMs, model: row.model });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - t0,
      error: ctl.signal.aborted ? "超时（15s）" : String(e).slice(0, 150),
    });
  } finally {
    clearTimeout(timer);
  }
});
