"use client";

import {
  CalendarDays,
  ListTodo,
  Mic,
  Sparkles,
  Star,
  Target,
  Users,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { t, useLang } from "@/i18n";

/**
 * 使用手册（REQ-使用手册）：面向用户的功能介绍与使用方式。
 * 纯静态内容，无接口调用；中英双份内容按界面语言选择（截图共用）。
 */
interface Section {
  icon: LucideIcon;
  h: string;
  rows: string[];
  /** 章节配图（/manual/ 下静态截图，给用户直观指引） */
  img?: string;
}

/** 中文手册（t() 包裹，key 即原文）：函数体在渲染期求值——
 *  模块顶层 const 求值时 currentLang 尚为默认 en，会把英文冻结进中文视图 */
const sectionsZh = (): Section[] => [
  {
    icon: Sparkles,
    h: t("拾光是什么"),
    rows: [
      t("AI 个人经营系统：时间 · 人际 · 财务。核心玩法就一条——随口说一句话，AI 自动识别其中的日程、待办、收支、心情、饮食，分别记进对应模块；你在各模块里查看、修正、复盘。"),
      t("网页端顶部导航：动态 / 目标 / 日程 / 人际 / 财务，点右上角头像进个人设置。"),
    ],
  },
  {
    icon: Mic,
    h: t("怎么记录一句话"),
    img: "/manual/web-feed.png",
    rows: [
      t("首页顶部输入框随口写一句（如「刚跑完步40分钟，心情不错」「明天下午三点看牙」「打车花了32块」），点发布或按 Enter（Shift+Enter 换行）。"),
      t("语音输入：按住输入框左下的话筒按钮说话，松开自动转成文字（最长 30 秒，到时自动停止）。音频不保存，转完即弃。"),
      t("发布后动态立刻上墙，AI 在后台做五域识别：🕒 日程 → 时间轴；📋 待办 → 待办清单；💰 收支 → 财务待确认流水；😊 心情 → 心情标签；🍽 饮食 → 饮食记录。识别置信度低的会标「待确认」，你点确认才生效。"),
      t("识别错了不用忍：动态卡上可逐项修改/删除，删除后各清单（含今日行动）会自动刷新。"),
    ],
  },
  {
    icon: ListTodo,
    h: t("今日行动与待办"),
    rows: [
      t("今日行动卡：首页里当天的行动清单，点卡片标题可收起/展开；输入框回车直接添加行动。"),
      t("点行首圆圈完成行动；行内菜单可编辑/删除；「今日已完成」区可恢复。"),
      t("完整待办管理（拆解子行动、每日重复、到期时间）在 日程 → todo 页。"),
    ],
  },
  {
    icon: CalendarDays,
    h: t("日程与日历"),
    img: "/manual/web-schedule.png",
    rows: [
      t("首页底部是今日日程时间轴；完整日历在 日程 页：日 / 周 / 月 / 年四种视图，周视图默认一周安排一屏可见。"),
      t("所有视图都能新增 / 编辑 / 删除日程，保存时自动做冲突检测。"),
    ],
  },
  {
    icon: Target,
    h: t("目标空间"),
    img: "/manual/web-spaces.png",
    rows: [
      t("目标 页为大目标建专属空间（考研上岸 / 副业过万…），把 TODO·行动、感悟和动态聚在一起，卡片展示 todo 进度、动态数与感悟数。"),
      t("空间详情里可以写感悟、看进度；相关动态自动归属。"),
    ],
  },
  {
    icon: Users,
    h: t("人际"),
    img: "/manual/web-contacts.png",
    rows: [
      t("人际 页有 列表 / 图谱 双视图：图谱以你为中心，联系人按重要程度（5 亲密 ~ 1 简单）分布在轨道上，可用鼠标/手指拖动摆位。"),
      t("联系人档案支持生日（阳历/农历）、纪念日、分组、备注；生日自动换算提醒（显示「N 天后生日」）。"),
      t("详情页汇集 TA 的往来时间线与关联人情账（送出为负、收到为正）。"),
    ],
  },
  {
    icon: Wallet,
    h: t("财务"),
    img: "/manual/web-finance.png",
    rows: [
      t("财务 页：本月收支/储蓄率概览、月度支出预算与预警、分类占比、账户管理。"),
      t("动态里说的钱先以「待确认流水」存在，确认入账后才算数——防止 AI 误识别污染账目；也可直接「记一笔」手动记账。"),
    ],
  },
  {
    icon: User,
    h: t("账户与设置"),
    img: "/manual/web-profile.png",
    rows: [
      t("登录：邮箱 + 密码。"),
      t("个人设置：改昵称、改密码、主题切换（深色/浅色/跟随系统）、导出数据（JSON / Markdown）、全端登出。"),
    ],
  },
  {
    icon: Star,
    h: t("小贴士"),
    rows: [
      t("1. 想到就说：「今天」「刚」「明天待会儿」这类时间词是 AI 判断日程/待办的关键。"),
      t("2. 财务先草稿后入账：动态里提到的花销不会直接进账本。"),
      t("3. 待办不用填时间：手动新增只写标题即可。"),
      t("4. 搜索框支持按动态原文/日程/todo/金额/联系人检索。"),
    ],
  },
];

const SECTIONS_EN: Section[] = [
  {
    icon: Sparkles,
    h: "What is Shiguang",
    rows: [
      "A self-hosted personal life OS: time · people · finance. The core loop is one thing — say a single sentence, and AI extracts the schedule, todos, transactions, mood and diet hidden inside it, filing each into its module. You then browse, correct and review in each module.",
      "Top navigation on web: Feed / Goals / Schedule / People / Finance. Click your avatar at the top right for settings.",
    ],
  },
  {
    icon: Mic,
    h: "How to capture a sentence",
    img: "/manual/web-feed.png",
    rows: [
      "Type a casual line in the composer at the top of the home page (e.g. \"Morning run 40 minutes, feeling great\", \"Dentist tomorrow at 3pm\", \"Taxi cost 32 yuan\"), then hit Post or Enter (Shift+Enter for a new line).",
      "Voice input: hold the mic button at the bottom-left of the composer and speak — it transcribes on release (30 seconds max). Audio is never stored; it is discarded right after transcription.",
      "Once posted, the moment appears instantly while AI extracts five domains in the background: 🕒 schedule → timeline; 📋 todo → todo list; 💰 money → pending transaction; 😊 mood → mood tag; 🍽 diet → diet record. Low-confidence items are marked \"pending\" and only take effect after you confirm.",
      "Wrong extraction? Fix it: every item on the moment card can be edited or deleted, and all lists (including today's actions) refresh automatically.",
    ],
  },
  {
    icon: ListTodo,
    h: "Today's actions & todos",
    rows: [
      "Today's actions card: the day's action list on the home page. Tap the card title to collapse/expand; pressing Enter in the composer adds an action directly.",
      "Tap the circle to complete an action; the row menu edits/deletes; the \"Done today\" area can restore items.",
      "Full todo management (sub-actions, daily repeats, due times) lives under Schedule → todos.",
    ],
  },
  {
    icon: CalendarDays,
    h: "Schedule & calendar",
    img: "/manual/web-schedule.png",
    rows: [
      "The bottom of the home page shows today's timeline; the full calendar is on the Schedule page with day / week / month / year views — the week view fits a whole week on one screen.",
      "Every view supports adding / editing / deleting blocks, with automatic conflict detection on save.",
    ],
  },
  {
    icon: Target,
    h: "Goal spaces",
    img: "/manual/web-spaces.png",
    rows: [
      "The Goals page gives each big goal (pass the exam / first 10k side income…) a dedicated space that gathers todos, reflections and moments, with progress cards showing todo progress, moment and reflection counts.",
      "Inside a space you can write reflections and track progress; related moments are attached automatically.",
    ],
  },
  {
    icon: Users,
    h: "People",
    img: "/manual/web-contacts.png",
    rows: [
      "The People page has list / graph views: the graph puts you at the center with contacts on orbits by importance (5 close ~ 1 casual); drag to rearrange.",
      "Contact profiles support birthdays (solar/lunar), anniversaries, groups and notes; birthdays auto-convert with countdown reminders (\"birthday in N days\").",
      "The detail page gathers that person's interaction timeline and linked gift ledger (given as negative, received as positive).",
    ],
  },
  {
    icon: Wallet,
    h: "Finance",
    img: "/manual/web-finance.png",
    rows: [
      "The Finance page: monthly income/expense & savings-rate overview, monthly budget with alerts, category breakdown, and account management.",
      "Money mentioned in moments first lands as a \"pending transaction\" and only counts after you confirm — so AI misreads never pollute the books. You can also add entries manually.",
    ],
  },
  {
    icon: User,
    h: "Account & settings",
    img: "/manual/web-profile.png",
    rows: [
      "Sign-in: email + password.",
      "Settings: change nickname or password, theme (dark/light/system), data export (JSON / Markdown), sign out everywhere.",
    ],
  },
  {
    icon: Star,
    h: "Tips",
    rows: [
      "1. Just say it: time words like \"today\", \"just now\", \"tomorrow\" are the key signals AI uses to place schedules and todos.",
      "2. Finance goes through a draft: amounts mentioned in moments never enter the books directly.",
      "3. Todos need no time: manual entry only requires a title.",
      "4. Search covers moment text, schedule, todos, amounts and contacts.",
    ],
  },
];

export default function ManualPage() {
  const { lang } = useLang();
  const sections = lang === "en" ? SECTIONS_EN : sectionsZh();
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gradient">
          {lang === "en" ? "Shiguang · User Guide" : t("拾光 · 使用手册")}
        </h1>
        <p className="mt-2 text-xs text-ink-faint">
          {lang === "en" ? "Say one sentence — AI files it into your life books" : t("随口说一句话，AI 帮你记进四本账")}
        </p>
      </div>

      {sections.map((sec) => (
        <section key={sec.h} className="glass mb-4 rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <sec.icon size={15} className="text-accent" aria-hidden />
            {sec.h}
          </h2>
          {sec.rows.map((r, i) => (
            <p key={i} className="mb-2 text-xs leading-relaxed text-ink-dim last:mb-0">
              {r}
            </p>
          ))}
          {sec.img && (
            <img
              src={sec.img}
              alt={lang === "en" ? `${sec.h} screenshot` : `${sec.h}界面截图`}
              loading="lazy"
              className="mt-3 w-full rounded-xl border border-line"
            />
          )}
        </section>
      ))}

      <footer className="mt-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2 py-0.5 text-[10px] text-ai">
          {lang === "en" ? "Shiguang · User Guide" : t("拾光 · 使用手册")}
        </span>
      </footer>
    </main>
  );
}
