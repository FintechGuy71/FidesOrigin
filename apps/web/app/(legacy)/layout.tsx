import Script from "next/script";

import { fontVariableClassNames } from "../_lib/fonts";
import { jsonLd, siteMetadata } from "../_lib/site";

import "@/css/style.css";
import "@/css/legacy.css";

/* ================================================================
   ROOT LAYOUT — 英文经典站（/pricing /docs /blog/... ）

   作用域说明：css/legacy.css 在此引入，只影响 (legacy) 与 [lang]/(legacy)
   两个分组下的页面，新版首页不会加载到它。
   legacy.css 整包在 @layer legacy 中，层序由 css/style.css 顶部的
   `@layer theme, base, components, legacy, utilities;` 固定。
   ================================================================ */

export const metadata = siteMetadata;

export default function LegacyRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* 同上：scroll-behavior 由 css/fio-design-system.css 的 @layer base 提供 */
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* [AUDIT FIX 2026-09-25 R7-6] JS 探针类：legacy.css 的 .reveal 初始
            隐身以此为门控（html.js .reveal），JS 被禁用/加载失败时经典站内容
            保持可见。必须用阻塞内联脚本在首帧前同步执行，不能用 next/script
            （defer 会在 CSS 生效后运行，产生闪烁窗口）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'document.documentElement.classList.add("js");',
          }}
        />
      </head>
      <body className={`${fontVariableClassNames} font-sans antialiased`}>
        {children}
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
