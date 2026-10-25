/**
 * 枚举双语映射（入库值保持中文，展示层按语言映射英文）：
 * - 交易分类/餐次/活动/模块/联系人分组等随业务数据入库的中文枚举，唯一可行策略是
 *   「入库值不变 + 展示映射」——AI 识别、表单提交、SQL 统计全部继续走中文值
 * - date/relative-time 的共享格式化也集中在此（收敛各页重复的「今天/昨天」实现）
 * - lang 默认 zh（回退中文原值，与 t() 同口径渐进安全）
 */
export type I18nLang = "zh" | "en";

/** 交易分类（TX_CATEGORIES 中文值 → 英文展示） */
const TX_CAT_EN: Record<string, string> = {
  餐饮: "Food",
  交通: "Transport",
  人情往来: "Social gifts",
  学习: "Learning",
  购物: "Shopping",
  娱乐: "Entertainment",
  医疗: "Medical",
  居住: "Housing",
  还款: "Repayment",
  其他: "Other",
};
export function txCatLabel(cat: string, lang: I18nLang = "zh"): string {
  return lang === "en" ? TX_CAT_EN[cat] ?? cat : cat;
}

/** 餐次（识别 schema 的中文枚举） */
const MEAL_EN: Record<string, string> = {
  早餐: "Breakfast",
  午餐: "Lunch",
  晚餐: "Dinner",
  加餐: "Snack",
  夜宵: "Late-night",
  未知: "Unknown",
};
export function mealLabel(meal: string, lang: I18nLang = "zh"): string {
  return lang === "en" ? MEAL_EN[meal] ?? meal : meal;
}

/** 时间块活动（中文名 → 英文展示；自定义活动名回退原文） */
const ACTIVITY_EN: Record<string, string> = {
  睡眠: "Sleep",
  工作: "Work",
  学习: "Study",
  健身: "Fitness",
  社交: "Social",
  娱乐: "Fun",
  家务: "Chores",
  通勤: "Commute",
  其他: "Other",
};
export function activityLabel(name: string, lang: I18nLang = "zh"): string {
  return lang === "en" ? ACTIVITY_EN[name] ?? name : name;
}

/** 模块名/导航（MODULE_REGISTRY 的中文 name/label → 英文） */
const MODULE_EN: Record<string, string> = {
  动态: "Feed",
  目标: "Goals",
  日程: "Schedule",
  人际: "People",
  财务: "Finance",
  拾光助手: "Assistant",
  健身: "Fitness",
  睡眠: "Sleep",
  收支复盘: "Budget review",
  "AI 复盘": "AI Review",
};
export function moduleLabel(name: string, lang: I18nLang = "zh"): string {
  return lang === "en" ? MODULE_EN[name] ?? name : name;
}

/** 联系人分组 */
const GROUP_EN: Record<string, string> = {
  家人: "Family",
  朋友: "Friend",
  同事: "Colleague",
  同学: "Classmate",
  客户: "Client",
  其他: "Other",
};
export function contactGroupLabel(group: string, lang: I18nLang = "zh"): string {
  return lang === "en" ? GROUP_EN[group] ?? group : group;
}

// ---------- 时间格式化（共享实现，收敛各页重复的「今天/昨天」） ----------

const WEEK_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 周名（idx 0=周一） */
export function weekName(idx: number, lang: I18nLang = "zh"): string {
  const arr = lang === "en" ? WEEK_EN : WEEK_ZH;
  return arr[idx] ?? "";
}

/** 北京日历日的展示（zh「9月17日」/ en "Sep 17"） */
export function dateLabel(y: number, m: number, d: number, lang: I18nLang = "zh"): string {
  if (lang === "en") {
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${MON[m - 1] ?? ""} ${d}`;
  }
  return `${m}月${d}日`;
}

/** 相对日期分组标签（feed/时间线分组头共用） */
export function dayGroupLabel(ymd: string, todayYmd: string, lang: I18nLang = "zh"): string {
  if (ymd === todayYmd) return lang === "en" ? "Today" : "今天";
  const t = new Date(`${todayYmd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  if (ymd === t.toISOString().slice(0, 10)) return lang === "en" ? "Yesterday" : "昨天";
  const [y, m, d] = ymd.split("-").map(Number);
  return dateLabel(y, m, d, lang);
}

/** 时长（zh「3小时20分」/ en "3h 20m"；整时/整分省略尾段） */
export function durationLabel(minutes: number, lang: I18nLang = "zh"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === "en") {
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }
  if (h && m) return `${h}小时${m}分`;
  if (h) return `${h}小时`;
  return `${m}分钟`;
}

/** 生日/到期倒计时（zh「N 天后」/ en "in N days"） */
export function daysLeftLabel(days: number, lang: I18nLang = "zh"): string {
  if (lang === "en") {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天后`;
}
