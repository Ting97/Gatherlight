"use client";

import { useState } from "react";
import { api } from "@/shared/api"; // 统一走 401 收口层：会话失效跳 /login（裸 client-api 不跳）
import { Modal } from "@/components/ui/modal";
import { useImeSubmit } from "@/lib/use-ime-submit";
import { CONTACT_GROUPS, GROUP_EMOJI, IMPORTANCE_TIERS, importanceLabel } from "@/lib/social";
import { lunarDayLabel, lunarMonthLabel } from "@/lib/lunar";
import { t as tr, tpl, getLang } from "@/i18n"; // t as tr：IMPORTANCE_TIERS.map((t) => 局部参数遮蔽 t
import { contactGroupLabel } from "@shiguangri/shared/i18n-enum";
import DatePicker from "@/components/date-picker";

export interface ContactDraft {
  id: string;
  name: string;
  alias: string | null;
  group_tag: string;
  birthday: string | null;
  birthday_cal?: string | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_leap?: boolean | null;
  anniversary: string | null;
  importance?: number;
  intimacy?: number | null;
  notes: string | null;
}

const LUNAR_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const LUNAR_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

/** 建档/编辑联系人弹层（列表页与 TA 档案页共用） */
export default function ContactFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ContactDraft | null;
  onClose: () => void;
  onSaved: (text: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [alias, setAlias] = useState(initial?.alias ?? "");
  // 默认分组=朋友（入库中文值，经 CONTACT_GROUPS 常量取，避免中文枚举字面量散落展示层）
  const [group, setGroup] = useState(initial?.group_tag ?? CONTACT_GROUPS[1]);
  const [bdayCal, setBdayCal] = useState<"solar" | "lunar">(initial?.birthday_cal === "lunar" ? "lunar" : "solar");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [lunarMonth, setLunarMonth] = useState<number>(initial?.lunar_month ?? 1);
  const [lunarDay, setLunarDay] = useState<number>(initial?.lunar_day ?? 1);
  const [lunarLeap, setLunarLeap] = useState(!!initial?.lunar_leap);
  const [anniversary, setAnniversary] = useState(initial?.anniversary ?? "");
  const [importance, setImportance] = useState<number>(initial?.importance ?? 3);
  // 亲密度 0~100：新建默认 50（服务端同款回落），编辑读已有值
  const [intimacy, setIntimacy] = useState<number>(initial?.intimacy ?? 50);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** 生日字段统一打包（历法 + 阳历日期 / 农历月日） */
  const birthdayPayload = () => ({
    birthdayCal: bdayCal,
    birthday: bdayCal === "solar" ? birthday || null : null,
    lunarMonth: bdayCal === "lunar" ? lunarMonth : undefined,
    lunarDay: bdayCal === "lunar" ? lunarDay : undefined,
    lunarLeap: bdayCal === "lunar" ? lunarLeap : undefined,
  });

  /** 保存（建档/更新）：按钮 submit 与表单 Enter 提交共用，守卫防双触发 */
  async function save() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        alias,
        group,
        ...birthdayPayload(),
        anniversary: anniversary || null,
        importance,
        intimacy,
        notes,
      };
      if (initial) {
        await api(`/api/contacts/${initial.id}`, "PATCH", payload);
        await onSaved(tr("💾 档案已更新"));
      } else {
        await api("/api/contacts", "POST", payload);
        await onSaved(tpl("✅ 已建档：{name}", { name: name.trim() }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ime = useImeSubmit(save);
  return (
    <Modal title={initial ? tr("编辑联系人") : tr("新建联系人")} onClose={onClose} busy={busy}>
      <form
        className="space-y-2.5"
        onSubmit={ime.onSubmit}
        onCompositionStart={ime.onCompositionStart}
        onCompositionEnd={ime.onCompositionEnd}
      >
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("姓名（必填）")}
              maxLength={30}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-sky-500"
            />
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={tr("备注名（如：老王）")}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm outline-none focus:border-sky-500"
            >
              {CONTACT_GROUPS.map((g) => (
                <option key={g} value={g}>{GROUP_EMOJI[g]} {contactGroupLabel(g, getLang())}</option>
              ))}
            </select>
            <DatePicker
              value={anniversary ?? ""}
              onChange={setAnniversary}
              ariaLabel={tr("纪念日（如：结婚纪念日）")}
              className="flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-sky-500"
            />
            <span className="flex items-center whitespace-nowrap text-micro text-ink-dim">{tr("纪念日")}</span>
          </div>
          <div>
            <div className="flex gap-2">
              {/* 生日历法切换：阳历=日期选择；农历=月/日选择 + 闰月标记 */}
              <div className="flex shrink-0 items-center rounded-lg border border-line-strong bg-surface p-0.5 text-xs">
                {([["solar", tr("阳历")], ["lunar", tr("农历")]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBdayCal(v)}
                    className={`rounded-md px-2.5 py-1 transition ${
                      bdayCal === v
                        ? "bg-gradient-to-r from-sky-500 to-indigo-500 font-medium text-white"
                        : "text-ink-mute hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bdayCal === "solar" ? (
                <DatePicker
                  value={birthday ?? ""}
                  onChange={setBirthday}
                  ariaLabel={tr("生日（阳历）")}
                  className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-sky-500"
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <select
                    value={lunarMonth}
                    onChange={(e) => setLunarMonth(Number(e.target.value))}
                    title={tr("农历月")}
                    className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-1.5 py-1.5 text-sm outline-none focus:border-sky-500"
                  >
                    {LUNAR_MONTHS.map((m) => (
                      <option key={m} value={m}>{lunarMonthLabel(m)}</option>
                    ))}
                  </select>
                  <select
                    value={lunarDay}
                    onChange={(e) => setLunarDay(Number(e.target.value))}
                    title={tr("农历日")}
                    className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-1.5 py-1.5 text-sm outline-none focus:border-sky-500"
                  >
                    {LUNAR_DAYS.map((d) => (
                      <option key={d} value={d}>{lunarDayLabel(d)}</option>
                    ))}
                  </select>
                  <label className="flex shrink-0 items-center gap-1 text-micro text-ink-mute" title={tr("闰月生日；当年无闰月时按平月过")}>
                    <input
                      type="checkbox"
                      checked={lunarLeap}
                      onChange={(e) => setLunarLeap(e.target.checked)}
                      className="h-3.5 w-3.5 accent-sky-500"
                    />
                    {tr("闰")}
                  </label>
                </div>
              )}
            </div>
            <p className="mt-1 text-micro text-ink-dim">
              {bdayCal === "lunar" ? tr("农历生日每年公历日期不同，会自动换算提醒 · 闰月生日无闰月年份按平月过") : tr("生日（可空）")}
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 text-micro text-ink-dim">
              {tr("重要程度")}
              <span className="text-ink-mute">{tr("决定图谱中与你的距离 · 当前：")}{tr(importanceLabel(importance))}</span>
            </div>
            <div className="flex gap-1">
              {[...IMPORTANCE_TIERS].reverse().map((t) => (
                <button
                  key={t.level}
                  type="button"
                  onClick={() => setImportance(t.level)}
                  className={`flex-1 rounded-lg px-1 py-1.5 text-xs transition ${
                    importance === t.level
                      ? "bg-gradient-to-r from-sky-500 to-indigo-500 font-medium text-white"
                      : "border border-line-strong bg-surface text-ink-mute hover:bg-elevated"
                  }`}
                >
                  {tr(t.label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-micro text-ink-dim">
              {tr("亲密度")}
              <span className="tabular-nums text-ink-mute">{intimacy}/100</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={intimacy}
              onChange={(e) => setIntimacy(Number(e.target.value))}
              className="h-6 w-full accent-sky-500"
              aria-label={tr("亲密度")}
            />
          </div>
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={tr("备注：喜好/忌讳/重要的事…")}
            className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-sky-500"
          />
          {err && <p className="text-xs text-danger">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-1.5 text-xs text-ink-mute hover:bg-soft">
              {tr("取消")}
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="btn-primary rounded-lg px-5 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {busy ? tr("保存中…") : initial ? tr("保存") : tr("建档")}
            </button>
          </div>
        </form>
    </Modal>
  );
}
