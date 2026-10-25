"use client";

/** 【我的 → 训记同步】配置卡（REQ-042）：每用户绑定自己的训记 Open API key。
 * 绑定即远端校验（坏 key 当场报原因不落库）；key AES 加密存储，界面只见脱敏形式 */
import { useCallback, useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { api } from "@/shared/api";
import { toast } from "@/shared/ui/toast";
import { t, tpl, getLang } from "@/i18n";
import { dateLabel } from "@shiguangri/shared/i18n-enum";
import { TagChip } from "@/components/tag-chip";
import { useArmConfirm } from "@/lib/use-arm-confirm";

interface KeyInfo {
  bound: boolean;
  apiKeyMasked?: string;
  updatedAt?: string;
}

export default function XunjiKeySection() {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const armRemove = useArmConfirm();

  const load = useCallback(() => {
    setErr(null);
    api<KeyInfo>("/api/fitness/xunji-key")
      .then(setInfo)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (busy || !input.trim()) return;
    setBusy(true);
    try {
      const j = await api<{ bound: boolean; apiKeyMasked: string }>("/api/fitness/xunji-key", "PUT", { apiKey: input.trim() });
      toast(tpl("✅ 训记已绑定（{key}）——健身页的「同步训记 / 回读打卡」即刻可用", { key: j.apiKeyMasked }));
      setInput("");
      setEditing(false);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!armRemove.arm("xunji-key")) return; // 两步确认（全站规范）
    setBusy(true);
    try {
      await api("/api/fitness/xunji-key", "DELETE");
      toast(t("已解绑训记 apiKey（此前写入训记的数据不受影响）"));
      setEditing(false);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  // 北京时间口径：UTC getter + 8h；展示按当前语言（与 profile 页同款）
  const zhDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
    const lang = getLang();
    return lang === "en"
      ? dateLabel(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), "en")
      : `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  };

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-soft">
        <TagChip icon={<Dumbbell size={12} />} label={t("训记同步")} tone="sky" />
      </h2>
      <p className="mb-3 text-micro text-ink-dim">
        {t("绑定自己训记 App 的 Open API key 后，训练计划可同步到训记、实练完成可回读打卡、助手可查询实练。")}{" "}
        {t("key 在训记 App「我的 → 设置 → Open API」里申请，加密存储不会明文展示。")}
      </p>

      {err ? (
        <div className="text-xs text-danger">
          {t("加载失败：")}{err}
          <button onClick={load} className="ml-2 underline underline-offset-2">{t("重试")}</button>
        </div>
      ) : info === null ? (
        <div className="space-y-1.5"><div className="skeleton h-4 w-40" /><div className="skeleton h-4 w-28" /></div>
      ) : info.bound && !editing ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-success">
            {tpl("已绑定 · {key}", { key: info.apiKeyMasked ?? "" })}
          </span>
          <span className="text-micro text-ink-faint">{tpl("更新于 {date}", { date: zhDate(info.updatedAt) ?? "" })}</span>
          <span className="ml-auto flex gap-2">
            <button onClick={() => setEditing(true)} className="rounded-xl border border-line-soft px-3 py-1.5 text-ink-mute transition hover:border-sky-500/50 hover:text-accent">
              {t("更换")}
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className={`rounded-xl border px-3 py-1.5 transition ${armRemove.armedId ? "border-rose-500 bg-rose-500/20 text-danger" : "border-rose-500/40 text-danger hover:bg-rose-500/10"}`}
            >
              {armRemove.armedId ? t("确认解绑？（3 秒内再点）") : t("解绑")}
            </button>
          </span>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={128}
            placeholder={t("粘贴训记 App 内申请的 Open API key")}
            className="input-glow min-w-0 flex-1 rounded-xl border border-line-soft bg-surface/60 px-4 py-2.5 text-sm outline-none placeholder:text-ink-faint"
          />
          <button
            onClick={save}
            disabled={busy || !input.trim()}
            className="btn-primary shrink-0 rounded-xl px-5 text-sm font-medium"
          >
            {busy ? t("校验中…") : t("绑定")}
          </button>
          {info.bound && (
            <button onClick={() => { setEditing(false); setInput(""); }} className="shrink-0 rounded-xl px-3 text-sm text-ink-mute hover:bg-soft">
              {t("取消")}
            </button>
          )}
        </div>
      )}
      {busy && !editing && <p className="mt-1.5 text-micro text-ink-faint">{t("正在向训记校验 key…")}</p>}
    </section>
  );
}
