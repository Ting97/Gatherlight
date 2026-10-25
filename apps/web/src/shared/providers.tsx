"use client";

/** 客户端 Providers（4-F + 9-B）：LangProvider + SessionProvider + 全局 Toast + 命令式确认弹窗，挂在根布局 */
import { LangProvider } from "@/i18n";
import { SessionProvider } from "@/shared/session";
import { ToastHost } from "@/shared/ui/toast";
import { ConfirmHost } from "@/shared/ui/confirm";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <SessionProvider>
        {children}
        <ToastHost />
        <ConfirmHost />
      </SessionProvider>
    </LangProvider>
  );
}
