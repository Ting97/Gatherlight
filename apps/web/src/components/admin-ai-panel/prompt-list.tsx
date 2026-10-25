"use client";

import { t } from "@/i18n";
import { getLang } from "@/i18n";
import type { PromptItem } from "./types";

interface Props {
  items: PromptItem[];
  selKey: string | null | undefined;
  onPick: (item: PromptItem) => void;
}

/** prompt 清单：分类分组 + 覆盖态徽标；移动端横滑、PC 左栏。
 * 分类值来自服务端中文枚举：列表与过滤两侧同经 t() 映射，保证两种语言下分组一致。
 * 双语（070）：清单为当前界面语言的模板版本，标题按语言取 title/titleEn */
export default function PromptList({ items, selKey, onPick }: Props) {
  const categories = [t("识别"), t("复盘"), t("目标"), t("助手"), t("系统")];
  const titleOf = (it: PromptItem) => (getLang() === "en" && it.titleEn ? it.titleEn : it.title);
  return (
    <div className="scrollbar-none -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:mb-0 lg:block lg:space-y-2.5 lg:overflow-visible lg:px-0">
      {categories.map((cat) => {
        const list = items.filter((x) => t(x.category) === cat);
        if (!list.length) return null;
        return (
          <div key={cat} className="flex gap-1.5 lg:block lg:space-y-1">
            <p className="hidden px-1 text-badge font-medium uppercase tracking-wider text-ink-faint lg:block">{cat}</p>
            {list.map((it) => (
              <button
                key={it.key}
                onClick={() => onPick(it)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs transition-all duration-200 lg:w-full ${
                  selKey === it.key
                    ? "bg-gradient-to-r from-sky-500 to-indigo-500 font-medium text-white shadow-md shadow-sky-500/25"
                    : "text-ink-mute hover:bg-wash hover:text-ink"
                }`}
              >
                {titleOf(it)}
                {it.overridden && (
                  <span
                    title={it.enabled ? t("DB 覆盖生效中") : t("覆盖已停用（用代码默认）")}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.enabled ? "bg-emerald-400" : "bg-amber-400"}`}
                  />
                )}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
