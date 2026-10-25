"use client";

import Link from "next/link";
import { t, useLang } from "@/i18n";

export default function NotFound() {
  // 订阅语言切换：t() 读模块级 currentLang，切换需触发本组件重渲染（登录页同款）
  useLang();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-ink">
      <p className="text-5xl">🕯️</p>
      <h1 className="mt-4 text-xl font-semibold">{t("这一页没有找到")}</h1>
      <p className="mt-2 text-sm text-ink-dim">{t("页面可能已被移动或删除")}</p>
      <Link
        href="/"
        className="mt-6 btn-primary rounded-xl px-5 py-2 text-sm font-medium"
      >
        {t("返回动态")}
      </Link>
    </main>
  );
}
