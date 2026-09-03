/* ================================================================
   404 视图 —— 内容与布局解耦。

   本项目有 4 个 root layout（英文首页 / 英文经典站 / 多语言 / 后台），
   因此不存在 app/layout.tsx，全局 app/not-found.tsx 会因缺少 root layout
   而编译失败。各路由组各自的 not-found.tsx 复用本组件，避免四处复制。

   ⚠ 本组件【不渲染 <main>】：(default) 路由下它由 HomeChrome 包裹，
     HomeChrome 已渲染 <main id="main-content">。此前本组件自己也渲染一个
     同名同 id 的 <main>，导致 out/404.html 出现嵌套 landmark + 重复 id，
     skip-link 命中的是外层空壳。
   ================================================================ */

import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locales";
import { localize } from "@/i18n/locales";

export default function NotFoundView({ lang = "en" }: { lang?: Locale }) {
  const d = getDictionary(lang).notFound;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--fio-ink)", color: "var(--fio-text)" }}
    >
      <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-[var(--fio-gold)]">
        404
      </p>
      <h1 className="mb-4 font-serif text-4xl font-medium tracking-tight sm:text-5xl">
        {d.title}
      </h1>
      <p className="mb-10 max-w-md text-sm leading-relaxed text-[var(--fio-text-3)]">{d.body}</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        {/* ⚠ 不要写尾斜杠：静态导出的产物是 out/cn.html，不是 out/cn/index.html */}
        <a href={localize("/", lang) || "/"} className="fio-btn fio-btn-primary">
          {d.home}
        </a>
        <a href={localize("/docs", lang)} className="fio-btn fio-btn-ghost">
          {d.docs}
        </a>
      </div>
    </div>
  );
}
