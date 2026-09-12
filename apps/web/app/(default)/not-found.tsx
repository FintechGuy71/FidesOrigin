import type { Metadata } from "next";

import NotFoundView from "@/components/not-found-view";

/* 英文首页分组的 404。使用 app/(default)/layout.tsx 作为 root layout。
   [AUDIT FIX R2-008] 静态导出时 out/404.html 由框架 not-found 边界生成
   （而非 app/(default)/404/page.tsx 路由），后者导出的 metadata 到不了产物
   ——out/404.html 曾带全站默认标题且可被索引。metadata 必须在此声明。 */
export const metadata: Metadata = {
  title: "404 — Page not found | FidesOrigin",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundView lang="en" />;
}
