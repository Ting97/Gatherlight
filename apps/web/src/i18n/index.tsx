"use client";

/**
 * 轻量 i18n（零依赖，纯静态导出约束下的客户端方案）：
 * - 中文原文即 key；en 字典映射，缺失翻译回退中文原文（渐进安全，长尾可后补）
 * - lang 存 localStorage `shiguang_lang`，默认 en；首帧防闪烁由 layout 内联脚本写
 *   documentElement.lang（静态导出的 SSR HTML 为构建态英文，切中文首帧短暂英文
 *   由 hydration 修正——纯客户端 i18n 的固有限制，与主题切换同口径）
 * - t() 为纯函数读模块级 currentLang：命令式 API（toast/confirm/工具函数）与
 *   React 组件均可用；组件内语言变更触发重渲染用 useLang()
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { EN } from "./en";

export type Lang = "zh" | "en";
export const LANG_KEY = "shiguang_lang";
export const DEFAULT_LANG: Lang = "en";

let currentLang: Lang = DEFAULT_LANG;

/** 翻译：zh 直接返回原文；en 查字典（缺失回退原文） */
export function t(key: string): string {
  if (currentLang === "zh") return key;
  return EN[key] ?? key;
}

/** 带插值的翻译：key 形如「共 {n} 条」，vars 填充 {n}（缺失占位保留原样便于排查） */
export function tpl(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/** 纯函数环境（fetch 包装/工具函数）读当前语言 */
export function getLang(): Lang {
  return currentLang;
}

function readStored(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "zh" || v === "en" ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  useEffect(() => {
    // localStorage 在 effect 读（SSR/prerender 无 window）；与内联脚本已写的
    // documentElement.lang 对齐，避免 hydration 后语言回跳
    setLangState(readStored());
  }, []);
  // render 期同步 currentLang（先于子组件 render 期的 t() 调用）。不能放 effect：
  // state 从默认语言变化触发的重渲染发生在 effect 重跑之前、之后无第三次渲染，
  // 子组件 t() 会永远读到旧语言（手册页等纯 useLang 页面中文模式显示英文的根因）
  currentLang = lang;
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  const setLang = (l: Lang) => {
    if (l === lang) return;
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* 隐私模式：本会话生效，不持久化 */
    }
    // t() 不订阅 Context：仅更新状态只重渲染 useLang() 消费者，其余组件停在旧语言
    // （表现为"点击没反应"）。整页刷新让全部组件按新语言重渲，首帧由内联脚本兜底
    window.location.reload();
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
