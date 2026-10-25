"use client";

import Reminders from "@/components/reminders";
import { api } from "@/shared/api";
import { toast } from "@/shared/ui/toast";
import type { ReminderItem } from "@/lib/reminders";
import { t, tpl } from "@/i18n";

/** W12 提醒横幅：生日/纪念日/到期 todo（可一键加入今日） */
export default function RemindersBanner({
  items,
  load,
}: {
  items: ReminderItem[];
  load: () => Promise<void>;
}) {
  return (
    <Reminders
      items={items}
      onMarkToday={async (todoId, label) => {
        // 返回成功与否给 Reminders 做乐观置位回滚（失败时恢复「今日」按钮可点）
        try {
          await api(`/api/todos/${todoId}`, "PATCH", { today: true });
          toast(t("☀️ 已加入今日 todo"));
          await load();
          return true;
        } catch {
          toast(tpl("加入今日失败（{label}…）", { label: label.slice(0, 20) }), "err");
          return false;
        }
      }}
    />
  );
}
