import Script from "next/script";

import HomeChrome from "@/components/home-chrome";

import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, siteMetadata } from "../_lib/site";

// Tailwind v4 入口（含 @theme、设计令牌与 @layer 层序声明）。
// 每个 root layout 都必须引入：原先只有 app/layout.tsx 引用它，
// 改为多 root layout 后若不逐个补上，主样式根本不会进入产物。
import "@/css/style.css";

/* ================================================================
   ROOT LAYOUT — 英文首页（/）

   本项目有 4 个 root layout（英文首页 / 英文经典站 / 多语言 / 后台），
   而不是单个 app/layout.tsx。原因：静态导出（output: 'export'）时
   <html lang> 必须在构建期确定，而 root layout 不在动态段下、拿不到
   params。原先所有页面共用一个硬编码 lang="en" 的 root layout，
   导致 /cn /tw /jp 的 SSR 输出也带着 lang="en"：
     · SEO 语义错误（爬虫看到的语言标注不对）
     · css/fio-design-system.css 与 css/legacy.css 里的
       html[lang="ja"] / html[lang="zh-TW"] CJK 排版规则在首屏完全失效，
       要等 hydration 后 LangSetter 改完 lang 才生效 → 字体与行高突变（FOUC）
   ================================================================ */

export const metadata = siteMetadata;

export default function DefaultRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* ⚠ 不要写 className="scroll-smooth"：css/fio-design-system.css 的
       @layer base 里已有 html{scroll-behavior:smooth}。两处表达同一意图时，
       改一处会被另一处"救回"，造成"改了没效果"的假象。 */
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>
        <HomeChrome lang="en">{children}</HomeChrome>
        {/* Privacy-friendly analytics (CSP already allows plausible.io) */}
        <Script
          defer
          data-domain="fidesorigin.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
