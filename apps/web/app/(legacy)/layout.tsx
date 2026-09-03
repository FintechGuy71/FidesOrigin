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
