"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { Dict } from "@/i18n/dictionaries/en";
import { langNames, langShort, locales, type Locale } from "@/i18n/locales";

/* ================================================================
   HEADER v2 — Minimal, institutional, with quiet confidence.
   Dictionary-driven; locale-aware links on localized homepages.
   ================================================================ */

/* ⚠ 全站 URL 一律【不带尾斜杠】。
   静态导出未开 trailingSlash，产物是 out/cn.html / out/docs.html，
   而不是 out/cn/index.html / out/docs/index.html。带尾斜杠的链接在
   Vercel 之外的任何静态托管上都会 404。
   EN 的前缀是空串，必须显式回退到 "/"。 */
function homeHref(lang: Locale): string {
  return lang === "en" ? "/" : `/${lang}`;
}
function pageHref(path: string, lang: Locale): string {
  return lang === "en" ? path : `/${lang}${path}`;
}

export default function Header({
  lang,
  d,
}: {
  lang: Locale;
  d: Dict["home"]["chrome"];
}) {
  const navLinks = [
    { href: `${homeHref(lang)}#capabilities`, label: d.capabilities, hash: true },
    { href: pageHref("/pricing", lang), label: d.pricing },
    { href: pageHref("/docs", lang), label: d.docs },
    { href: pageHref("/blog", lang), label: d.blog },
    { href: pageHref("/demo", lang), label: d.demo },
    { href: "https://github.com/FintechGuy71/FidesOrigin", label: d.github, external: true },
  ];

  /* 语言名改用 i18n/locales.ts 的 langNames / langShort —— 原先在此硬编码
     四个字符串，与 locales.ts 的常量重复，改一处会漏另一处。 */
  const langLinks = locales.map((l) => ({
    href: homeHref(l),
    label: langNames[l],
    short: langShort[l],
    current: l === lang,
  }));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const mobileMenuId = "mobile-menu";
  const langMenuId = "lang-menu";
  const langRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  /* 语言菜单 + 移动菜单：点击外部 / Esc 关闭。
     原先只有语言菜单有此逻辑，移动菜单既不能 Esc 关闭、点击外部也不收起，
     键盘用户被困在展开的菜单里。两个菜单共用一份监听。 */
  useEffect(() => {
    if (!langOpen && !mobileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (langOpen && langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
      if (mobileOpen && mobileRef.current && !mobileRef.current.contains(target)) {
        setMobileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (langOpen) {
          /* [AUDIT FIX R2-048] Esc 关闭后焦点返还触发按钮（此前落在 body） */
          langRef.current
            ?.querySelector<HTMLButtonElement>(`button[aria-controls="${langMenuId}"]`)
            ?.focus();
        }
        setLangOpen(false);
        setMobileOpen(false);
        return;
      }
      /* [AUDIT FIX R2-048] role="menu" 契约要求方向键导航：
         菜单打开时 ↑/↓ 在 menuitem 间循环，Home/End 跳首尾。
         此前只有 role 标注没有键盘行为，读屏用户被承诺了 menu 语义
         却得不到对应的交互。 */
      if (!langOpen) return;
      const menu = langRef.current?.querySelector<HTMLDivElement>(`#${langMenuId}`);
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]'));
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLAnchorElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1 + items.length) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [langOpen, mobileOpen]);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[var(--z-nav)]"
      style={{
        background: "var(--fio-ink-scrim)",
        backdropFilter: "blur(24px) saturate(1.2)",
        WebkitBackdropFilter: "blur(24px) saturate(1.2)",
        borderBottom: "1px solid var(--fio-border-subtle)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href={homeHref(lang)} className="flex items-center gap-2.5">
          <img
            src="/brand/logo-icon-56.png"
            alt="FidesOrigin"
            width="28"
            height="28"
            className="rounded-sm"
          />
          <div className="flex flex-col">
            <span className="font-serif text-sm font-medium leading-none tracking-tight text-[var(--fio-text)]">
              FidesOrigin
            </span>
            {/* 0.6875rem = 11px。原为 0.65rem(10.4px)，低于可读下限。 */}
            <span className="font-mono text-[0.6875rem] tracking-wider text-[var(--fio-text-3)]">
              ON-CHAIN COMPLIANCE
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                /* hover 态改用 CSS 类：原先由 onMouseEnter 直接改写 DOM 的
                   style.color，内联优先级高于任何 CSS，触屏点击后 hover 态
                   会粘滞，且无法被 prefers-reduced-motion 等媒体查询控制。 */
                className="rounded-md px-3 py-1.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
              >
                {link.label}
              </a>
            ) : link.hash ? (
              /* 同页锚点保持原生 <a>：Link 的 hash 导航在跨页时才需要路由 */
              <a
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
              >
                {link.label}
              </a>
            ) : (
              /* [AUDIT FIX R2-049] 站内跨页导航改用 next/link：
                 静态导出下裸 <a> 每次跳转整页刷新、重新执行全部 JS；
                 Link 走客户端路由（同 root layout 组内无刷新切换）。
                 prefetch=false：91 页站点避免默认 prefetch 扫全站。 */
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
              >
                {link.label}
              </Link>
            )
          )}
          {/* Language dropdown */}
          <div className="relative ml-2" ref={langRef}>
            <button
              onClick={() => {
                const next = !langOpen;
                setLangOpen(next);
                /* [AUDIT FIX R2-048] 菜单打开后焦点移入第一项：
                   与下方方向键导航配套（焦点若留在按钮上，↑/↓ 无作用对象）。
                   Esc 关闭时焦点仍在 document.activeElement（菜单内），
                   由 onKeyDown 的 Escape 分支关闭后浏览器自然回落，
                   这里补充：关闭时把焦点还给按钮。 */
                if (next) {
                  requestAnimationFrame(() => {
                    langRef.current
                      ?.querySelector<HTMLDivElement>(`#${langMenuId}`)
                      ?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')
                      ?.focus();
                  });
                }
              }}
              aria-label={d.language}
              aria-expanded={langOpen}
              aria-haspopup="menu"
              aria-controls={langMenuId}
              onKeyDown={(e) => {
                /* 按钮上的方向键也直接进入菜单（menu-button 标准行为） */
                if (langOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  e.preventDefault();
                  langRef.current
                    ?.querySelector<HTMLDivElement>(`#${langMenuId}`)
                    ?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')
                    ?.focus();
                }
              }}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
            >
              {lang.toUpperCase()}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className={`transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {langOpen && (
              <div
                id={langMenuId}
                role="menu"
                className="absolute right-0 top-full z-[var(--z-dropdown)] mt-1 min-w-[120px] rounded-md border border-[var(--fio-border-light)] py-1 backdrop-blur-xl"
                style={{ background: "var(--fio-ink-scrim)" }}
              >
                {langLinks.map((l) => (
                  <a
                    key={l.short}
                    href={l.href}
                    role="menuitem"
                    aria-current={l.current ? "true" : undefined}
                    className={`block px-4 py-2 text-sm transition-colors hover:bg-white/5 hover:text-[var(--fio-text)] ${
                      l.current ? "text-[var(--fio-gold)]" : "text-[var(--fio-text-2)]"
                    }`}
                    onClick={() => setLangOpen(false)}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/admin/dashboard"
            prefetch={false}
            className="ml-3 rounded-md border border-[var(--fio-gold-dim)] bg-[var(--fio-gold-glow)] px-4 py-1.5 text-sm font-medium text-[var(--fio-gold)] transition-all hover:bg-[var(--fio-gold-dim)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
          >
            {d.dashboard}
          </Link>
        </nav>

        {/* Mobile toggle */}
        {/* h-11 w-11 = 44×44，满足触控目标最小尺寸。
            原写法 h-8 w-8(32px) 与内联 minHeight/minWidth:44px 互相打架，
            实际渲染 44px 但类名表达的却是 32px，改动时极易误判。 */}
        <button
          className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] md:hidden focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={d.toggleMenu}
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {mobileOpen ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav
          id={mobileMenuId}
          aria-label={d.toggleMenu}
          ref={mobileRef}
          className="border-t border-[var(--fio-border-subtle)] px-4 py-4 md:hidden"
          style={{ background: "var(--fio-ink-scrim)" }}
        >
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md px-3 py-2.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ) : link.hash ? (
              <a
                key={link.label}
                href={link.href}
                className="block rounded-md px-3 py-2.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              /* [AUDIT FIX R2-049] 移动端菜单同样改客户端路由 */
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                className="block rounded-md px-3 py-2.5 text-sm text-[var(--fio-text-2)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            href="/admin/dashboard"
            prefetch={false}
            className="mt-2 block rounded-md px-3 py-2.5 text-sm font-medium text-[var(--fio-gold)] transition-colors hover:bg-[var(--fio-gold-dim)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none"
            onClick={() => setMobileOpen(false)}
          >
            {d.dashboard} →
          </Link>
          <div className="mt-3 flex items-center gap-1 border-t border-[var(--fio-border-subtle)] pt-3">
            {langLinks.map((l) => (
              <a
                key={l.short}
                href={l.href}
                aria-current={l.current ? "true" : undefined}
                className={`rounded-md px-3 py-2 text-sm transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none ${
                  l.current ? "text-[var(--fio-gold)]" : "text-[var(--fio-text-3)]"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {l.short}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
