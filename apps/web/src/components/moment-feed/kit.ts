import { bjDayIdx, isoToBjInput, bjInputToIso, zhTime } from "@/lib/bj-time";
import { getLang, t as tr } from "@/i18n";
import { dateLabel, dayGroupLabel } from "@shiguangri/shared/i18n-enum";
import { yuan as sharedYuan } from "@shiguangri/shared/finance";

/**
 * moment-feed 小工具集：时间格式化 / 金额展示 / 表单值互转 / 常量。
 * 纯函数无副作用，被入口与卡片各子组件共用。
 */

/** 北京墙上时钟（实现单源 @shiguangri/shared，UTC+8 推算禁本地 getter） */
export const zhClock = zhTime;

/** 北京日历日 YYYY-MM-DD（UTC+8 推算，禁本地 getter） */
const bjYmd = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

/** 记录时刻 →「今天 15:32 / 昨天 21:04 / 9月15日 08:30」（en：Today / Yesterday / Sep 15；
 *  跨年时带年前缀，zh「2025年9月17日」/ en "2025 Sep 17"，tr("年") 在 en 映射为空格） */
export const zhRecordTime = (iso: string) => {
  const t = Date.parse(iso);
  const nowT = Date.now();
  const diffDays = bjDayIdx(nowT) - bjDayIdx(t);
  const clock = zhClock(iso);
  const lang = getLang();
  if (diffDays === 0 || diffDays === 1) return { day: dayGroupLabel(bjYmd(t), bjYmd(nowT), lang), clock };
  const d = new Date(t + 8 * 3600_000);
  const sameYear = d.getUTCFullYear() === new Date(nowT + 8 * 3600_000).getUTCFullYear();
  return {
    day: `${sameYear ? "" : d.getUTCFullYear() + tr("年")}${dateLabel(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), lang)}`,
    clock,
  };
};

/** 金额展示（¥ 前缀 + shared 整数取商余版 yuan，禁浮点除法） */
export const yuan = (cents: number) => `¥${sharedYuan(cents)}`;

/** 待办时间标签：有起始时间且与到期同日 →「9:10–9:30」区间；否则退回单时刻 */
export function todoTimeLabel(startAt: string | null | undefined, dueAt: string | null): string | null {
  if (!dueAt) return null;
  if (startAt) {
    const a = Date.parse(startAt);
    const b = Date.parse(dueAt);
    const sameDay = bjDayIdx(a) === bjDayIdx(b);
    if (sameDay && b !== a) return `${zhClock(startAt)}–${zhClock(dueAt)}`;
  }
  const t = zhRecordTime(dueAt);
  return `${t.day} ${t.clock}`;
}

/** 跨天时间块的日期前缀：非今天 →「9月17日 」（en "Sep 17 "；避免凌晨记录的"昨天下午"被误读为今天） */
export const dayPrefix = (iso: string) => {
  const t = Date.parse(iso);
  const d = new Date(t + 8 * 3600_000);
  return bjDayIdx(Date.now()) - bjDayIdx(t) === 0
    ? ""
    : `${dateLabel(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), getLang())} `;
};

export const COMMON_MOODS = ["开心", "满足", "兴奋", "放松", "平静", "疲惫", "焦虑", "烦躁", "难过", "生气"];

// 五域/关系域中文名（待确认提示等处使用）：中文入库值放映射表 key 位（enum 口径），
// 倒排生成 domain→中文；en 展示走 DOMAIN_LABELS_EN
const DOMAIN_ZH_KEY: Record<string, string> = {
  日程: "schedule",
  收支: "finance",
  心情: "mood",
  饮食: "diet",
  关系: "people",
};
const DOMAIN_LABELS_EN: Record<string, string> = {
  schedule: "Schedule", todo: "Todo", finance: "Finance", mood: "Mood", diet: "Diet", people: "People",
};
export const DOMAIN_LABELS: Record<string, string> = {
  todo: "todo",
  ...Object.fromEntries(Object.entries(DOMAIN_ZH_KEY).map(([zh, k]) => [k, zh])),
};
export function domainLabel(domain: string): string {
  if (getLang() === "en") return DOMAIN_LABELS_EN[domain] ?? domain;
  return DOMAIN_LABELS[domain] ?? domain;
}

export const FEED_PAGE_SIZE_HINT = 10; // 超过一页才显示「到底啦」提示

export const isoToLocalInput = (iso: string | null) => (iso ? isoToBjInput(iso) : "");

export const localInputToIso = (v: string) => bjInputToIso(v);
