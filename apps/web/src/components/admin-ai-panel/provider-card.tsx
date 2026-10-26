"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Languages, Plug, Trash2 } from "lucide-react";
import { api } from "@/shared/api";
import { t, tpl } from "@/i18n";

/**
 * 模型接入卡片（071 BYOK）：多 OpenAI 兼容服务商档案（自备 API key）+ 一键激活切换；
 * 不激活任何档案 = 服务器环境变量兜底。替换原「调用引擎」卡（Jev 影子观测下线自 UI）。
 * key 服务端掩码下发；编辑时空值 = 保留旧 key。
 */

interface Profile {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  visionModel: string | null;
  keyMasked: string;
  active: boolean;
  updatedAt: string;
}

interface ProviderList {
  profiles: Profile[];
  env: { model: string; baseUrl: string; hasKey: boolean; visionModel: string | null };
  envActive: boolean;
}

const BASE_URL_SUGGESTIONS = [
  "https://api.tokenfactory.nebius.com/v1",
  "https://api.openai.com/v1",
  "https://open.bigmodel.cn/api/paas/v4",
  "https://api.deepseek.com/v1",
  "https://api.moonshot.cn/v1",
];
const MODEL_SUGGESTIONS = [
  "nvidia/Nemotron-3_5-Lightning",
  "gpt-4o-mini",
  "glm-4-flash",
  "deepseek-chat",
  "moonshot-v1-8k",
];

const hostOf = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
};

export default function ProviderCard({ notify }: { notify: (text: string, ok?: boolean) => void }) {
  const [data, setData] = useState<ProviderList | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  // 编辑态：null=收起；"new"=新建；uuid=编辑该档案
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  // 删除两步确认（3s 复位）
  const [armId, setArmId] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  const load = useCallback(async () => {
    try {
      setData(await api<ProviderList>("/api/admin/ai-providers"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("加载失败"), false);
    }
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  function startEdit(p: Profile | "new") {
    if (p === "new") {
      setEditing("new"); setLabel(""); setBaseUrl(""); setApiKey(""); setModel(""); setVisionModel("");
    } else {
      setEditing(p.id); setLabel(p.label); setBaseUrl(p.baseUrl); setApiKey(""); setModel(p.model); setVisionModel(p.visionModel ?? "");
    }
  }

  async function save() {
    if (saving) return;
    if (!label.trim() || !baseUrl.trim() || !model.trim() || (editing === "new" && !apiKey)) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        label: label.trim(), baseUrl: baseUrl.trim(), model: model.trim(),
        visionModel: visionModel.trim() || null,
      };
      if (apiKey) body.apiKey = apiKey;
      if (editing === "new") await api("/api/admin/ai-providers", "POST", body);
      else await api(`/api/admin/ai-providers/${editing}`, "PUT", body);
      notify(editing === "new" ? t("服务商档案已创建") : t("服务商档案已保存"));
      setEditing(null);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("操作失败"), false);
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string | null) {
    try {
      const j = await api<{ active: { label: string } | null }>("/api/admin/ai-providers/activate", "PUT", { id });
      notify(j.active ? tpl("已激活「{label}」（立即生效）", { label: j.active.label }) : t("已切回环境变量默认（立即生效）"));
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("操作失败"), false);
    }
  }

  async function test(p: Profile) {
    if (testing) return;
    setTesting(p.id);
    try {
      const j = await api<{ ok: boolean; latencyMs?: number; error?: string }>(`/api/admin/ai-providers/${p.id}/test`, "POST");
      if (j.ok) notify(tpl("「{label}」连通（{ms}ms · {model}）", { label: p.label, ms: j.latencyMs ?? 0, model: p.model }));
      else notify(tpl("「{label}」不通：{err}", { label: p.label, err: j.error ?? "" }), false);
    } catch (e) {
      notify(e instanceof Error ? e.message : t("操作失败"), false);
    } finally {
      setTesting(null);
    }
  }

  async function remove(p: Profile) {
    if (armId !== p.id) {
      setArmId(p.id);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmId(null), 3000);
      return;
    }
    setArmId(null);
    try {
      await api(`/api/admin/ai-providers/${p.id}`, "DELETE");
      notify(tpl("「{label}」已删除", { label: p.label }));
      if (editing === p.id) setEditing(null);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("操作失败"), false);
    }
  }

  const inputCls = "input-glow w-full rounded-xl border border-line-soft bg-surface/60 px-3 py-2 text-xs outline-none placeholder:text-ink-faint";

  return (
    <div className="mb-4 rounded-2xl border border-line-soft bg-surface/50 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Plug size={14} className="text-accent" />
        <h3 className="text-sm font-semibold text-ink">{t("模型接入")}</h3>
        <span className="text-micro text-ink-faint">
          {t("自备 API key 接入任意 OpenAI 兼容服务商，一键切换；未激活时使用服务器环境变量")}
        </span>
      </div>

      {/* 环境变量兜底行 */}
      <div className={`mb-2 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${data?.envActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-line-soft bg-bg/30"}`}>
        <Languages size={12} className={data?.envActive ? "text-success" : "text-ink-faint"} />
        <span className="font-medium text-ink">{t("环境变量默认")}</span>
        <span className="text-ink-mute">{data?.env.model ?? "…"}</span>
        <span className="text-ink-faint">·</span>
        <span className="text-ink-faint">{hostOf(data?.env.baseUrl ?? "")}</span>
        <span className="text-ink-faint">· {data?.env.hasKey ? t("已配置 key") : t("未配置 key")}</span>
        <span className="flex-1" />
        {data?.envActive ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 font-medium text-success"><Check size={11} />{t("使用中")}</span>
        ) : (
          <button onClick={() => void activate(null)} className="rounded-lg border border-line-soft px-2.5 py-1 text-micro text-ink-soft transition hover:border-sky-500/50 hover:text-accent">
            {t("切回此配置")}
          </button>
        )}
      </div>

      {/* 档案行 */}
      {data?.profiles.map((p) => (
        <div key={p.id} className={`mb-2 rounded-xl border px-3 py-2 text-xs ${p.active ? "border-emerald-500/40 bg-emerald-500/5" : "border-line-soft bg-bg/30"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{p.label}</span>
            {p.active && <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-micro font-medium text-success"><Check size={11} />{t("使用中")}</span>}
            <span className="text-ink-mute">{p.model}</span>
            <span className="text-ink-faint">· {hostOf(p.baseUrl)}</span>
            <span className="text-ink-faint">· key {p.keyMasked}</span>
            <span className="flex-1" />
            {!p.active && (
              <button onClick={() => void activate(p.id)} className="rounded-lg border border-line-soft px-2.5 py-1 text-micro text-ink-soft transition hover:border-sky-500/50 hover:text-accent">
                {t("激活")}
              </button>
            )}
            <button onClick={() => void test(p)} disabled={testing === p.id} className="rounded-lg border border-line-soft px-2.5 py-1 text-micro text-ink-soft transition hover:border-sky-500/50 hover:text-accent disabled:opacity-50">
              {testing === p.id ? t("测试中…") : t("测试")}
            </button>
            <button onClick={() => startEdit(p)} className="rounded-lg border border-line-soft px-2.5 py-1 text-micro text-ink-soft transition hover:border-sky-500/50 hover:text-accent">
              {t("编辑")}
            </button>
            <button
              onClick={() => void remove(p)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-micro transition ${armId === p.id ? "border-rose-500 bg-rose-500/10 font-medium text-danger" : "border-line-soft text-ink-soft hover:border-rose-500/50 hover:text-danger"}`}
            >
              <Trash2 size={11} />{armId === p.id ? t("确认删除？") : t("删除")}
            </button>
          </div>
        </div>
      ))}

      {/* 新建/编辑表单 */}
      {editing ? (
        <div className="mt-2 space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <datalist id="pv-base-urls">{BASE_URL_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
          <datalist id="pv-models">{MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-micro text-ink-dim">{t("名称")}</span>
              <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nebius / OpenAI / GLM…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-micro text-ink-dim">{t("模型 ID")}</span>
              <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} list="pv-models" placeholder="nvidia/Nemotron-3_5-Lightning" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-micro text-ink-dim">Base URL（OpenAI 兼容，含 /v1）</span>
            <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} list="pv-base-urls" placeholder="https://…" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-micro text-ink-dim">API key{editing !== "new" && <span className="text-ink-faint">（{t("不填保留原值")}）</span>}</span>
              <input className={inputCls} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={editing === "new" ? "sk-…" : "••••"} autoComplete="new-password" />
            </label>
            <label className="block">
              <span className="mb-1 block text-micro text-ink-dim">{t("视觉模型 ID（可选，截图识别用）")}</span>
              <input className={inputCls} value={visionModel} onChange={(e) => setVisionModel(e.target.value)} placeholder="glm-4v-flash / gpt-4o-mini" />
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => void save()} disabled={saving} className="btn-primary rounded-xl px-4 py-1.5 text-xs font-medium disabled:opacity-50">
              {saving ? t("保存中…") : t("保存档案")}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-xl border border-line-soft px-3 py-1.5 text-xs text-ink-soft transition hover:text-ink">
              {t("取消")}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => startEdit("new")} className="w-full rounded-xl border border-dashed border-line-soft px-3 py-2 text-xs text-ink-mute transition hover:border-sky-500/50 hover:text-accent">
          ＋ {t("新建服务商档案")}
        </button>
      )}
    </div>
  );
}
