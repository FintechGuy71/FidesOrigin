"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  Locale,
  locales,
  langNames,
  langShort,
  langPrefix,
  localize,
} from "@/i18n/locales";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   LEGACY HEADER — unified classic-site navigation, dictionary-driven
   across all four locales. The wallet cluster renders only on pages
   with real on-chain interaction (address-check).
   ================================================================ */

/* ⚠ 全站 URL 一律不带尾斜杠：静态导出未开 trailingSlash，产物是
   out/cn.html / out/docs.html，而不是 out/cn/index.html / out/docs/index.html。
   EN 的前缀是空串，必须显式回退到 "/"。 */
function homeHref(lang: Locale): string {
  return langPrefix(lang) || "/";
}

type Props = {
  lang: Locale;
  dict: Dict;
  /** Current page path without locale prefix, e.g. "/pricing" */
  pagePath: string;
  /** Locales where this page exists; others fall back to locale home */
  availableLocales?: readonly Locale[];
  /** Render the wallet connect cluster (address-check only) */
  wallet?: boolean;
};

export default function LegacyHeader({ lang, dict, pagePath, availableLocales, wallet }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  /* [AUDIT FIX] prefix 死变量已删（原语言链接逻辑迁移到 langHref/homeHref 后零消费） */
  const available = availableLocales ?? locales;

  /* 该语言没有此页时回退到该语言首页。⚠ 不能写 langPrefix(l) + "/"。 */
  const langHref = (l: Locale) =>
    available.includes(l) ? localize(pagePath, l) : homeHref(l);

  const links = [
    { href: `${homeHref(lang)}#features`, label: dict.nav.features },
    { href: localize("/use-cases/stablecoin-compliance", lang), label: dict.nav.useCases },
    { href: localize("/pricing", lang), label: dict.nav.pricing },
    { href: localize("/docs", lang), label: dict.nav.docs },
    { href: localize("/blog", lang), label: dict.nav.blog },
  ];

  // EN has a dedicated /contact page; other locales jump to the
  // localized homepage contact section.
  const ctaHref = lang === "en" ? "/contact" : `${homeHref(lang)}#contact`;

  /* 移动菜单：Esc 关闭 + 打开时锁滚动 + 焦点管理。
     该菜单是常驻 DOM 的 role="dialog" aria-modal="true"（靠 .active 显隐），
     此前没有任何键盘关闭路径，键盘用户被困在里面。
     [AUDIT FIX R2-046] 补齐：打开时焦点移入菜单（关闭按钮），
     Tab 焦点圈在菜单内（focus trap），关闭后焦点返还触发按钮。 */
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      // focus trap：Tab 循环圈在菜单内部
      const menu = mobileMenuRef.current;
      if (!menu) return;
      const focusables = menu.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // 打开后把焦点移入菜单
    mobileMenuRef.current?.querySelector<HTMLElement>(".mobile-menu-close")?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  /* [AUDIT FIX R2-047] 语言菜单：Esc 关闭 + 焦点返还 + 方向键导航
     （点击外部由 backdrop 层处理） */
  const langToggleRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        langToggleRef.current?.focus();
        return;
      }
      const menu = langMenuRef.current;
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [langOpen]);

  /* [AUDIT FIX R1-X1] 点击外部关闭：改用 pointerdown-outside 模式
     （与 components/ui/header.tsx 一致）。原实现用全屏 backdrop 层（z-backdrop:55）
     盖住导航来接收外部点击，但 .nav（z-nav:50）创建了层叠上下文，
     其内部的 #langMenu（z-dropdown:60）只在 nav 上下文内生效——
     根层 backdrop(55) > nav(50)，导致 backdrop 同时盖住了菜单本身：
     鼠标点击任何语言项都命中 backdrop → 菜单关闭而不导航。
     pointerdown-outside 无遮挡层，两类点击都正常。 */
  const langWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!langOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (langWrapRef.current && !langWrapRef.current.contains(target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [langOpen]);

  const walletSvg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 7h1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13v2M19 7V5M19 7h-5.5a1.5 1.5 0 0 0 0 3H19" />
    </svg>
  );

  return (
    <>
      <nav className="nav" aria-label={dict.nav.mainNav}>
        <div className="nav-inner">
          <a href={homeHref(lang)} className="nav-logo">
            <img
              src="/brand/logo-dark-icon.png"
              alt="FidesOrigin"
              className="nav-logo-icon"
              width={28}
              height={28}
            />
            FidesOrigin
          </a>
          <div className="nav-left">
            {links.map((l) => (
              /* [AUDIT FIX R2-049] 站内导航改 next/link（同 root layout 组内
                 客户端路由，无整页刷新；跨 root layout 如 #features 指向首页时
                 Link 自动回退硬导航，行为与 <a> 一致）。
                 prefetch=false：91 页站点避免默认预取扫全站。 */
              <Link key={l.href + l.label} href={l.href} prefetch={false}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            <div className="lang-dropdown" ref={langWrapRef}>
              <button
                id="langToggleBtn"
                ref={langToggleRef}
                aria-label={dict.nav.language}
                aria-expanded={langOpen}
                aria-haspopup="menu"
                aria-controls="langMenu"
                onClick={(e) => {
                  e.stopPropagation();
                  setLangOpen(!langOpen);
                }}
              >
                {langShort[lang]}
                <svg className="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {/* ⚠ legacy.css 里曾有 `#langMenu a:first-child { color: var(--accent) }`，
                  无条件高亮第一项（English）。在 /cn /tw /jp 页面上会显示
                  "当前语言 = English" 的错误状态。改为按当前 lang 打 .active，
                  CSS 同步改为 `.active`（见 css/legacy.css）。
                  [AUDIT FIX R2-047] 补 role="menu"/"menuitem" 与按钮 aria-controls 对应。 */}
              <div id="langMenu" ref={langMenuRef} role="menu" aria-label={dict.nav.language} style={{ display: langOpen ? "block" : "none" }}>
                {locales.map((l) => (
                  <a
                    key={l}
                    href={langHref(l)}
                    role="menuitem"
                    className={l === lang ? "active" : undefined}
                    aria-current={l === lang ? "true" : undefined}
                    onClick={() => setLangOpen(false)}
                  >
                    {langNames[l]}
                  </a>
                ))}
              </div>
            </div>
            <div className="nav-divider"></div>
            {wallet && (
              <div className="wallet-connect-wrap">
                <button className="wallet-btn" id="wallet-btn" aria-label={dict.nav.connect}>
                  {walletSvg}
                  {dict.nav.connect}
                </button>
                <div className="wallet-connected" id="wallet-connected">
                  <div className="wallet-info">
                    <span className="wallet-address" id="wallet-address"></span>
                    <span className="wallet-network-badge" id="wallet-network">
                      Sepolia
                    </span>
                  </div>
                  <button className="wallet-disconnect" id="wallet-disconnect" aria-label={dict.nav.disconnect}>
                    {dict.nav.disconnect}
                  </button>
                </div>
              </div>
            )}
            <Link href={ctaHref} className="nav-cta" prefetch={false}>
              {dict.nav.getStarted}
            </Link>
          </div>
          <button
            className="nav-mobile-btn"
            ref={mobileToggleRef}
            aria-label={dict.nav.toggleMenu}
            aria-expanded={mobileOpen}
            aria-controls="mobileMenu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`mobile-menu${mobileOpen ? " active" : ""}`}
        id="mobileMenu"
        ref={mobileMenuRef}
        role="dialog"
        aria-modal="true"
        aria-label={dict.nav.mobileNav}
        /* 关闭时对读屏与 Tab 序隐藏：该节点常驻 DOM，仅靠 .active 控制显隐 */
        aria-hidden={mobileOpen ? undefined : "true"}
      >
        <button
          type="button"
          className="mobile-menu-close"
          aria-label={dict.nav.closeMenu}
          onClick={() => {
            setMobileOpen(false);
            /* [AUDIT FIX R2-046] 关闭后焦点返还触发按钮 */
            mobileToggleRef.current?.focus();
          }}
        >
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} prefetch={false} onClick={() => setMobileOpen(false)}>
            {l.label}
          </Link>
        ))}
        <div className="lang-row">
          {locales.map((l) => (
            <Link key={l} href={langHref(l)} prefetch={false}>
              {langShort[l]}
            </Link>
          ))}
        </div>
        {wallet && (
          <>
            <div className="mobile-wallet-area" id="mobile-wallet-connected">
              <span id="mobile-wallet-address"></span>
              <button id="mobile-wallet-disconnect" aria-label={dict.nav.disconnect}>
                {dict.nav.disconnect}
              </button>
            </div>
            <button className="wallet-btn" id="mobile-wallet-btn" aria-label={dict.nav.connect}>
              {walletSvg}
              {dict.nav.connect}
            </button>
          </>
        )}
      </div>

      {/* [AUDIT FIX R1-X1] 原全屏 backdrop 层（点击外部关闭语言菜单）已移除：
          .nav 创建层叠上下文，根层 backdrop(z:55) 盖住 nav(z:50) 内部的菜单，
          导致点击语言项只关闭菜单而不导航。改由 langWrapRef 的
          pointerdown-outside 监听实现（见上方 useEffect）。 */}

      {/* Wallet connect behavior (self-hosted, lazy-loads ethers on demand) */}
      {wallet && <Script src="/wallet-connect.js" strategy="afterInteractive" />}
    </>
  );
}
