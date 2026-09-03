import type { Metadata } from "next";

import NotFoundView from "@/components/not-found-view";

/* 真实的 /404 路由。
   本项目采用多 root layout（见 app/(default)/layout.tsx 注释），因此
   app/not-found.tsx 无法使用，Next.js 静态导出时 out/404.html 会退化成
   框架默认页（无品牌样式）。这里提供一个真实路由：Next.js 的静态导出
   会把 /404 直接输出为 out/404.html，正好补回品牌 404 页。 */
export const metadata: Metadata = {
  title: "404 — Page not found | FidesOrigin",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return <NotFoundView lang="en" />;
}
