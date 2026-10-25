/**
 * 内置空间展示映射（REQ-018）：kind='sport' 的运动空间是系统预置（不可改名/删除），
 * 名称与描述按界面语言展示英文版；其余空间（用户数据）原样展示。
 * 库内值保持服务端创建的中文原文——识别/联动等按 id 关联不受影响。
 */
import { t, getLang } from "@/i18n";

type SpaceLike = { name: string; description?: string | null; kind?: string | null };

export function spaceName(s: SpaceLike): string {
  return s.kind === "sport" && getLang() === "en" ? "Sport" : s.name;
}

export function spaceDesc(s: SpaceLike): string {
  if (s.kind === "sport" && getLang() === "en") return t("内置训练空间：计划 · 打卡 · 趋势，兼有 TODO·行动 / 感悟 / 动态");
  return s.description ?? "";
}
