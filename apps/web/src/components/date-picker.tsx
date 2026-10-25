"use client";

/**
 * 自定义日期选择器（替换原生 <input type="date">）：
 * 原生控件的显示格式/占位跟随浏览器 UI 语言（Chrome 中文显示「年/月/日」），页面无法控制——
 * 比赛评委用英文浏览器看到的是英文、中文用户看到中文，二者恰好都不跟随站点语言。
 * 本组件显示值与月历文案（月名/周标题/按钮词）全部走站点 i18n：en → "Oct 25, 2026"，zh → "2026年10月25日"。
 * 接口对齐原生：value "YYYY-MM-DD"（"" 为空）、onChange(同格式)、max（禁选未来）、clearable。
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { t, tpl, getLang, useLang } from "@/i18n";
import { bjToday } from "@/lib/date";

const MONTHS_ZH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// 周标题固定周日开始（en Su..Sa；zh 日..六）
const WEEKDAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** "2026-10-25" → zh "2026年10月25日" / en "Oct 25, 2026"（纯字符串拆解，无时区换算） */
export function formatDateByLang(v: string, lang: "zh" | "en" = getLang()): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  const [, y, mo, d] = m;
  if (lang === "en") {
    const month = MONTHS_EN[Number(mo) - 1];
    return `${month.slice(0, 3)} ${Number(d)}, ${y}`;
  }
  return `${y}年${Number(mo)}月${Number(d)}日`;
}

export default function DatePicker({
  value,
  onChange,
  max,
  ariaLabel,
  className,
}: {
  value: string; // "YYYY-MM-DD" 或 ""
  onChange: (v: string) => void; // "" = 清除
  /** 上限日期 "YYYY-MM-DD"（如禁止选未来） */
  max?: string;
  ariaLabel?: string;
  /** 触发按钮样式（调用方沿用原 input 的 className 保持布局一致） */
  className?: string;
}) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // 弹层视角月：打开时初始化为选中月（无值→今天月）
  const [view, setView] = useState(() => {
    const base = value || bjToday();
    const [y, m] = base.split("-").map(Number);
    return { y, m };
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPanel = () => {
    const base = value || bjToday();
    const [y, m] = base.split("-").map(Number);
    setView({ y, m });
    setOpen(true);
  };

  const today = bjToday();
  const isDisabledDay = (iso: string) => !!max && iso > max;
  // 月历网格：视角月 1 号所在周的周日开始，铺 42 格（覆盖任意月跨 6 行的情形）
  const firstDow = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const cells: Array<{ iso: string; day: number } | null> = [];
  const startUTC = Date.UTC(view.y, view.m - 1, 1 - firstDow);
  for (let i = 0; i < 42; i++) {
    const dt = new Date(startUTC + i * 86_400_000);
    const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    cells.push(dt.getUTCMonth() + 1 === view.m ? { iso, day: dt.getUTCDate() } : null);
  }

  const label = value ? formatDateByLang(value, lang) : t("选择日期");
  return (
    <div ref={rootRef} className="relative inline-block">
      <span className="flex w-full items-center gap-1">
        <button
          type="button"
          onClick={openPanel}
          aria-label={ariaLabel ?? t("选择日期")}
          aria-expanded={open}
          title={ariaLabel}
          className={`min-w-0 flex-1 truncate text-left ${className ?? ""}`}
        >
          {label}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("清空日期")}
            title={t("清空日期")}
            className="shrink-0 rounded p-0.5 text-ink-faint transition hover:bg-wash hover:text-ink"
          >
            <X size={11} aria-hidden />
          </button>
        )}
      </span>
      {open && (
        <div className="absolute left-0 top-full z-[80] mt-1 w-60 rounded-xl border border-line-soft bg-elevated p-2 shadow-2xl shadow-scrim/70">
          <div className="mb-1 flex items-center gap-1">
            <button
              type="button"
              aria-label={t("上一月")}
              onClick={() => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { ...v, m: v.m - 1 }))}
              className="rounded p-1 text-ink-mute transition hover:bg-wash hover:text-ink"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="flex-1 text-center text-xs font-medium text-ink">
              {lang === "en" ? `${MONTHS_EN[view.m - 1]} ${view.y}` : `${view.y}年${MONTHS_ZH[view.m - 1]}`}
            </span>
            <button
              type="button"
              aria-label={t("下一月")}
              onClick={() => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { ...v, m: v.m + 1 }))}
              className="rounded p-1 text-ink-mute transition hover:bg-wash hover:text-ink"
            >
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-micro text-ink-faint">
            {(lang === "en" ? WEEKDAYS_EN : WEEKDAYS_ZH).map((w) => (
              <span key={w} className="py-0.5">{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {cells.map((c, i) =>
              c ? (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabledDay(c.iso)}
                  onClick={() => {
                    onChange(c.iso);
                    setOpen(false);
                  }}
                  className={`rounded py-1 tabular-nums transition ${
                    c.iso === value
                      ? "bg-accent font-medium text-white"
                      : c.iso === today
                        ? "text-accent hover:bg-wash"
                        : "text-ink hover:bg-wash"
                  } ${isDisabledDay(c.iso) ? "cursor-not-allowed opacity-30" : ""}`}
                >
                  {c.day}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
          <p className="mt-1 text-center text-micro text-ink-faint">
            {tpl("{d} 为今天", { d: formatDateByLang(today, lang) })}
          </p>
        </div>
      )}
    </div>
  );
}
