import type { Viewport } from "next";
import ChunkErrorReloader from "@/components/chunk-error-reloader";
import Nav from "@/components/nav";
import RegisterSw from "@/components/register-sw";
import ErrorBoundary from "@/shared/ui/error-boundary";
import Providers from "@/shared/providers";
import "./globals.css";

export const metadata = {
  // metadata 在静态导出时构建期固化（SSR HTML 为构建态英文），无法运行期双语——
  // 与 description 同口径取纯英文，品牌名用罗马字 Shiguang（i18n 全覆盖约定）
  title: "Shiguang — Personal Life OS",
  description: "Capture life in one sentence — AI organizes your schedule, todos, finance, mood & diet. Self-hosted, your data stays yours.",
  // PWA（REQ-009 FR-B8）：此前 manifest.json 存在但从未挂载——应用根本不可安装
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Shiguang",
    statusBarStyle: "black-translucent" as const,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617", // 深色默认；防闪烁脚本与切换按钮会在运行时同步更新
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

/** 首帧前解析主题（防闪烁）：localStorage 记忆 → 未设置时跟随系统；同步 meta theme-color。
 *  同步语言到 documentElement.lang（i18n 纯函数 t() 首帧即正确；SSR HTML 为构建态英文，
 *  中文用户首帧文本由 hydration 修正——纯静态导出下的固有限制） */
const themeScript = `(function(){try{var m=localStorage.getItem("shiguang_theme");if(m!=="dark"&&m!=="light")m="system";var l=m==="light"||(m==="system"&&window.matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",l?"#f1f5f9":"#020617")}catch(e){}try{var g=localStorage.getItem("shiguang_lang");document.documentElement.lang=g==="zh"?"zh-CN":"en"}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased text-ink">
        <Providers>
          <ChunkErrorReloader />
          {/* 导航全局唯一挂载：顶栏宽度与页面内容容器解耦（各页 max-w 不同导致的长度不齐在此统一） */}
          <Nav />
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
        <RegisterSw />
      </body>
    </html>
  );
}
