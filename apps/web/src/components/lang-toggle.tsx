"use client";

/**
 * 语言切换（导航栏入口）：下拉菜单选择目标语言，勾选当前项。
 * 多语言扩展：往 LANGUAGES 注册表加一行 + 对应字典包即可，交互无需改动。
 * 选择不同语言后整页刷新——t() 是读模块级变量的纯函数、不订阅 Context，
 * 仅刷新 LangProvider 消费者会出现大面积残留（历史 bug：点击"没反应"）；
 * 首帧语言由 layout 内联脚本写 documentElement.lang，刷新后无闪错。
 */
import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useLang, t, type Lang } from "@/i18n";

/** 语言注册表：展示名用各自语言书写（勿翻译——用户凭母语识别自己的语言） */
export const LANGUAGES: Array<{ code: Lang; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("切换语言")}
        aria-label={t("切换语言")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap-lg rounded-full p-2 text-ink-mute transition hover:bg-wash hover:text-accent"
      >
        <Languages className="h-4 w-4" strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[70] mt-1 min-w-36 overflow-hidden rounded-xl border border-line-soft bg-elevated py-1 shadow-2xl shadow-scrim/70"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={lang === l.code}
              onClick={() => {
                setOpen(false);
                if (l.code !== lang) setLang(l.code);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition hover:bg-wash"
            >
              <Check className={`h-3.5 w-3.5 shrink-0 text-accent ${lang === l.code ? "opacity-100" : "opacity-0"}`} />
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
