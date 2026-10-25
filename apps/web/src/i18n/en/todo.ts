/**
 * todo 域词条：本批 i18n 全覆盖改造新增（key=中文界面原文）。
 * 覆盖：todo/row-menu·menu-item、todo-board 全部子件与 hooks、todo-board.tsx、todo-bits.tsx、inline-rename.tsx。
 * 通用词条（保存/取消/删除/加载中… 等）在 common.ts；与 spaces（目标空间关联 TODO）/home（今日行动）
 * 同值的词条（截止时间（可清空）/每日重复：完成后次日…/删除行动/删除 todo 等）直接复用，勿重复添加。
 */
export const EN: Record<string, string> = {
  // ---- 行操作菜单（components/todo/row-menu.tsx · 全站唯一权威菜单） ----
  "编辑标题 / 描述": "Edit title / notes",
  "关闭每日重复": "Turn off daily repeat",
  "每日重复（次日 6 点恢复）": "Daily repeat (resets next day at 6:00)",
  "已完成 ×{n}": "Done ×{n}",
  "已关闭每日重复": "Daily repeat turned off",
  "🔁 已设为每日重复": "🔁 Set to repeat daily",
  "AI 细化为更小行动": "AI refine into smaller steps",
  "插入到该行动之后": "Inserted after this action",
  "编辑标题与时间": "Edit title & time",
  "取消重要标记": "Unmark important",
  "标记为重要": "Mark as important",
  "已取消重要": "Unmarked as important",
  "⭐ 已标记为重要": "⭐ Marked as important",
  "移出今日": "Remove from today",
  "标记为今日": "Mark for today",
  "今日标记跨零点自动失效": "The today mark auto-expires at midnight",
  "已移出今日": "Removed from today",
  "☀️ 已加入今日": "☀️ Added to today",
  "关联空间": "Link to space",
  "添加行动": "Add action",
  "AI 拆解为可执行的行动": "AI break into actionable steps",
  "已有 {n} 个未完成行动：": "{n} unfinished actions:",
  "清空未完成行动后重拆（已完成保留）": "Clears unfinished actions, then re-breaks (done ones kept)",
  "追加到末尾": "Append to end",
  "保留现有行动，新行动接在后面": "Keeps existing actions; new ones go after them",
  "↩️ 「{title}」已恢复": "↩️ \"{title}\" restored",
  "其下行动一并删除": "Its actions are deleted too",
  "已开启": "On",

  // ---- 提交类操作（use-todo-actions.ts / use-todo-data.ts / todo-board.tsx） ----
  "📌 已添加「{title}」": "📌 Added \"{title}\"",
  "添加失败：{msg}": "Failed to add: {msg}",
  "🎉 完成「{title}」": "🎉 Done: \"{title}\"",
  "AI 拆解失败": "AI breakdown failed",
  "「{title}」{hint}": "\"{title}\"{hint}",
  "最多显示最近 200 条已完成的顶层 todo": "Shows the latest 200 completed top-level todos",

  // ---- 添加任务行 / 卡片 / 行动详情面板（add-todo-row / todo-card / action-note-panel） ----
  "添加 todo，回车保存": "Add a todo, Enter to save",
  "重要标记": "Mark as important",
  "今日标记（跨零点自动失效，每天重新规划）": "Today mark (auto-expires at midnight; replan daily)",
  "不关联空间": "No space",
  "空间：{name}": "Space: {name}",
  "行动进度": "Action progress",

  // ---- 行动子区（child-area.tsx） ----
  "{title}（点击查看详情）": "{title} (tap for details)",
  "有点击查看详情": "Has details — tap to view",
  "每日重复（06:00 日切自动恢复未完成）": "Daily repeat (auto-resets at 06:00)",
  "行动，回车添加（Esc 结束）": "Action, Enter to add (Esc to finish)",
  "还没有行动 —— 行右侧「⋯」里添加，或让 AI 拆解": "No actions yet — add via the ⋯ menu on the row, or let AI break it down",
  "已完成的 todo 不可再添加行动": "Completed todos can't take new actions",

  // ---- 视图空态（kit.ts emptyText；chip 标签复用 fitness「今日」/people「重要」/common「全部」/home「已完成」） ----
  "今天还没安排 ☀️ —— 在上面添加 todo（会自动标记今日），或把 ⭐重要 / 📋全部 里的 todo 标为今日": "Nothing planned for today ☀️ — add a todo above (auto-marked for today), or mark one from ⭐ Important / 📋 All",
  "还没有重要 todo ⭐ —— 添加时勾选「重要」，或把现有 todo 标为重要": "No important todos yet ⭐ — tick \"Important\" when adding, or mark an existing todo",
  "暂无 todo —— 在上面添加一个，或在主页随口说一句（AI 会自动识别 todo）": "No todos yet — add one above, or just say it on the home page (AI extracts todos)",
  "还没有已完成的 todo ✓": "No completed todos yet ✓",

  // ---- 与既有词条同值但审计解析不到的补录（common.ts 的「操作失败」为无引号 key、pages2.ts 的「重新生成」与
  //      他 key 同行——i18n-audit 逐行解析拿不到；值与他域一致，EN 聚合后者覆盖，无行为差异） ----
  "操作失败": "Operation failed",
  "重新生成": "Regenerate",

  // ---- 共用小件（todo-bits.tsx：到期标签 / 勾选圆圈；N 天后走 shared daysLeftLabel） ----
  "已过期": "Overdue",
  "点击恢复为未完成": "Click to restore as unfinished",
  "点击标记完成": "Click to mark done",
  "标记完成": "Mark done",

  // ---- 空间名就地编辑（inline-rename.tsx） ----
  "名称不能为空": "Name cannot be empty",
  "名称过长（≤{n} 字）": "Name too long (≤{n} chars)",
  "重命名": "Rename",
};
