"use client";

import type { FeedMoment } from "@/lib/types";
import { api } from "@/shared/api";
import { domainLabel } from "./kit";
import { t, tpl } from "@/i18n";
import type { RunFn } from "./types";

interface PendingConfirmsProps {
  m: FeedMoment;
  run: RunFn;
}

/** 待确认的低置信识别（识别登记簿 pending）：逐域确认入账 / 忽略 */
export function PendingConfirms({ m, run }: PendingConfirmsProps) {
  // 低置信待确认域（识别登记簿 pending）
  const pendingDomains = (Object.entries(m.recognitions ?? {}) as [string, { status: string; confidence: number }][])
    .filter(([, v]) => v.status === "pending")
    .map(([domain, v]) => ({ domain, confidence: v.confidence }));

  if (pendingDomains.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {pendingDomains.map((d) => (
        <div key={d.domain} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-micro text-warn/90">
          <span>🤔 {tpl("识别到{domain}（置信度 {pct}%），确认吗？", { domain: domainLabel(d.domain), pct: Math.round((d.confidence ?? 0) * 100) })}</span>
          <button
            onClick={() => run(async () => { await api(`/api/entries/${m.id}/confirm`, "POST", { domain: d.domain }); return t("✅ 已确认入账"); })}
            className="tap-lg press rounded bg-sky-600 px-2.5 py-1 text-badge font-medium text-white hover:bg-sky-500"
          >
            {t("确认")}
          </button>
          <button
            onClick={() => run(async () => { await api(`/api/entries/${m.id}/confirm`, "POST", { domain: d.domain, ignore: true }); return t("已忽略"); })}
            className="tap-lg press rounded px-2.5 py-1 text-badge text-ink-mute hover:text-ink"
          >
            {t("忽略")}
          </button>
        </div>
      ))}
    </div>
  );
}
