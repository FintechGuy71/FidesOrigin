"use client";

import { useParams } from "next/navigation";

import HomeChrome from "@/components/home-chrome";
import NotFoundView from "@/components/not-found-view";
import { isPrefixedLocale } from "@/i18n/locales";

/* 多语言分组的 404（/cn/... /tw/... /jp/... 的无效路径）。
   使用 app/[lang]/layout.tsx 作为 root layout，因此 <html lang> 会正确。

   ⚠ app/[lang]/layout.tsx 只渲染 {children}，HomeChrome 挂在
     [lang]/(home)/layout.tsx 上。若不在这里补一层 HomeChrome，
     多语言 404 会是一个没有 header/footer 的裸页，与英文 404 外观不一致。
   ⚠ not-found.tsx 拿不到 params，只能在客户端用 useParams() 读；
     静态导出构建期 params 为空时回退到 "en"，不会崩。 */
export default function LocaleNotFound() {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang && isPrefixedLocale(params.lang) ? params.lang : "en";

  return (
    <HomeChrome lang={lang}>
      <NotFoundView lang={lang} />
    </HomeChrome>
  );
}
