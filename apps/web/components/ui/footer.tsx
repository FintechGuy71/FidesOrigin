"use client";

import Link from "next/link";

import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   FOOTER v2 — Minimal, institutional, quietly authoritative.
   Dictionary-driven; locale-aware links on localized homepages.
   ================================================================ */

/* ⚠ 全站 URL 一律不带尾斜杠（详见 components/ui/header.tsx 顶部注释）：
   静态导出未开 trailingSlash，out/ 下是 docs.html 而不是 docs/index.html。
   localize() 返回的已是无尾斜杠路径，不要再手工拼 "/"。 */
function href(path: string, lang: Locale): string {
  return localize(path, lang);
}

export default function Footer({
  lang,
  d,
}: {
  lang: Locale;
  d: Dict["home"]["chrome"];
}) {
  return (
    <footer
      style={{
        background: "var(--fio-ink)",
        /* 原为硬编码 var(--fio-border-hairline)，与设计系统令牌不同值 */
        borderTop: "1px solid var(--fio-border-hairline)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Left */}
          <div className="flex items-center gap-2.5">
          {/* Logo */}
          <img
            src="/brand/logo-icon-56.png"
            alt="FidesOrigin"
            width="24"
            height="24"
            className="rounded-sm border border-[var(--fio-gold-dim)] bg-[var(--fio-gold-glow)]"
          />
          <div className="flex flex-col">
              <span
                className="font-serif text-sm font-medium leading-none text-[var(--fio-text)]"
              >
                FidesOrigin
              </span>
              {/* 原为 text-[0.6rem](9.6px) + --fio-text-4(对比度 1.9:1)，
                  双重不可读。提升到 11px，并改用 --fio-text-3。 */}
              <span
                className="font-mono text-[0.6875rem] tracking-wider text-[var(--fio-text-3)]"
              >
                PROGRAMMABLE COMPLIANCE
              </span>
            </div>
          </div>

          {/* Center links */}
          {/* [AUDIT FIX R2-049] 站内链接改 next/link 客户端路由；
              mailto 与 GitHub 外链保留原生 <a>。 */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link
              href={href("/pricing", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.pricing}
            </Link>
            <Link
              href={href("/docs", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.docs}
            </Link>
            <Link
              href={href("/blog", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.blog}
            </Link>
            <Link
              href={href("/demo", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.demo}
            </Link>
            {/* [AUDIT FIX R1-X2] /address-check 此前是孤儿页（全站零链接可达），
                补入新版 footer，与 legacy footer 的修复保持同一可达性口径。 */}
            <Link
              href={href("/address-check", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.addressCheck}
            </Link>
            <Link
              href={href("/brand", lang)}
              prefetch={false}
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.brand}
            </Link>
            <a
              href="https://github.com/FintechGuy71/FidesOrigin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.github}
            </a>
            <a
              href="mailto:contact@fidesorigin.com"
              className="inline-block py-2.5 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm"
            >
              {d.contact}
            </a>
          </div>

          {/* Right */}
          <div className="font-mono text-xs text-[var(--fio-text-3)]">{d.rights}</div>
        </div>
      </div>
    </footer>
  );
}
