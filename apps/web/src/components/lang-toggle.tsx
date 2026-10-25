"use client";

/**
 * 语言切换（导航栏入口）：英文 ↔ 中文 两态循环。
 * 首帧语言由 layout 内联脚本写入 documentElement.lang；本组件挂载后读 localStorage 对齐，
 * 切换经 LangProvider 落存储并触发全站重渲染（t() 模块级 currentLang 同步更新）。
 */
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useLang, t } from "@/i18n";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const label = mounted ? (lang === "en" ? "英文" : "中文") : "英文";
  return (
    <button
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      title={t(`切换语言，当前${label}`)}
      aria-label={t(`切换语言，当前${label}`)}
      className="tap-lg shrink-0 rounded-full p-2 text-ink-mute transition hover:bg-wash hover:text-accent"
    >
      <Languages className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
