"use client";

import { BarChart3, TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";
import SubNav, { type SubNavItem } from "./sub-nav";
import { useSession } from "@/shared/session";
import { t } from "@/i18n";

/**
 * 财务二级 tab（REQ-003 3-F FR-C2.8；REQ-005 FR-4.4 更名）：概览 | 收支复盘。
 * 收支复盘按 me.modules 条件渲染（未授权不渲染入口，直连路由由 API 403 + 页面「未开通」态兜底）。
 * 路由：/finance、/finance/review。
 */
export default function FinanceTabs() {
  const pathname = usePathname();
  // 会话走 useSession() 单源（session.tsx 约定：组件禁止散拉 /api/auth/me——旧版每个财务页多发一次请求）
  const { user } = useSession();
  const modules = user?.modules ?? null;

  const has = (m: string) => modules?.includes(m) ?? false;

  const items: SubNavItem[] = [
    { key: "/finance", label: t("概览"), icon: <BarChart3 size={12} />, href: "/finance" },
    ...(has("trade_review") ? [{ key: "/finance/review", label: t("收支复盘"), icon: <TrendingUp size={12} />, href: "/finance/review" }] : []),
  ];

  return <SubNav className="mb-5" ariaLabel={t("财务二级导航")} items={items} value={pathname} />;
}
