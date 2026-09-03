import { fontVariableClassNames } from "../_lib/fonts";
import { adminMetadata } from "../_lib/site";

import "@/css/style.css";

/* ================================================================
   ROOT LAYOUT — 后台（/admin/dashboard）

   ⚠ 后台刻意【不注入】站点 JSON-LD 与 Plausible 分析脚本：
     · JSON-LD 里的 Organization / WebSite / SoftwareApplication 会把
       运营后台标记为官方营销页，是错误的 SEO 信号
     · 分析脚本会把后台操作计入站点统计，污染数据
   ⚠ metadata 用 adminMetadata（robots: noindex）：运营后台含合约管理、
     风险扫描与钱包连接，不应被搜索引擎收录，也不应带营销 OG 卡片。
     public/robots.txt 已同步补 Disallow: /admin/dashboard。
   ================================================================ */

export const metadata = adminMetadata;

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* 同上：scroll-behavior 由 css/fio-design-system.css 的 @layer base 提供 */
  return (
    <html lang="en">
      <body className={`${fontVariableClassNames} font-sans antialiased`}>{children}</body>
    </html>
  );
}
