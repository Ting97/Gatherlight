"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { Dismissable } from "./dismissable";

/** 分类图标候选（emoji 网格，按主题分组）。
 *  工厂函数而非模块顶层常量：组名需按当前语言取 t()，import 期调用会定格语言（i18n 约定） */
const iconGroups = (): Array<[string, string[]]> => [
  [t("预设"), ["😴", "💼", "📚", "💪", "👥", "🎮", "🧹", "🚌", "📌"]],
  [t("运动"), ["🏃", "🚴", "🏊", "🧘", "⚽", "🏀", "🎾", "🥊", "🤸"]],
  [t("学习"), ["✍️", "🧠", "💻", "📖", "✏️", "🔍", "🎓", "🔬", "🧩"]],
  [t("生活"), ["🍳", "🍜", "☕", "🛒", "🧺", "🛏️", "🚿", "🌱", "🐶", "🐱"]],
  [t("娱乐"), ["🎬", "🎵", "📺", "📱", "🎨", "🎲", "🎣", "📷", "🎈", "🀄"]],
  [t("社交"), ["❤️", "🎁", "🍻", "☎️", "💬", "🎉", "👨‍👩‍👧", "🤝", "🫶"]],
  [t("出行"), ["✈️", "🚗", "🚕", "🚲", "🗺️", "🏔️", "🏖️", "🏕️"]],
  [t("健康"), ["💊", "🩺", "🌿", "🫁", "🦷", "👁️"]],
  [t("其他"), ["⭐", "🔥", "💰", "🧾", "⏰", "🌙", "☀️", "🎯", "🛠️", "💡"]],
];

/** 图标选择器：点击展开 emoji 网格；支持自定义输入任意字符 */
export default function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t("点击选择图标")}
        className="flex h-9 w-12 items-center justify-center rounded border border-line-strong bg-surface text-base hover:border-sky-500"
      >
        {value || "🏷"}
      </button>
      {open && (
        <Dismissable onClose={() => setOpen(false)} className="absolute left-0 top-10 z-30 max-h-[65vh] w-72 overflow-y-auto rounded-xl border border-line bg-surface p-3 shadow-xl">
          {iconGroups().map(([group, icons]) => (
              <div key={group} className="mb-1.5 last:mb-0">
                <p className="mb-1 text-badge text-ink-dim">{group}</p>
                <div className="flex flex-wrap gap-1">
                  {icons.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => {
                        onChange(ic);
                        setOpen(false);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded text-base hover:bg-soft ${
                        value === ic ? "bg-sky-600/80 ring-1 ring-sky-400" : ""
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-1 border-t border-line-soft pt-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  // 放行 Escape：外层 Dismissable 在 document 层监听 Esc 关浮层，下面的 stopPropagation 会把它吞掉
                  if (e.key === "Escape") return;
                  // IME 守卫：中文输入法选词回车不应当作确认
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && custom.trim()) {
                    onChange([...custom.trim()][0] ?? custom.trim());
                    setCustom("");
                    setOpen(false);
                  }
                  e.stopPropagation();
                }}
                placeholder={t("自定义：粘贴 emoji 后回车")}
                className="flex-1 rounded border border-line-strong bg-bg px-2 py-1 text-xs outline-none focus:border-sky-500"
              />
            </div>
        </Dismissable>
      )}
    </span>
  );
}
