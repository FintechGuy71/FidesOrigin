"use client";

import Link from "next/link";

import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

/* ================================================================
   FOOTER v3 — Institutional multi-column footer.
   品牌列（定位语）+ 三组链接列 + 底部法律行，
   对齐顶级金融机构官网（GS / JPM / BlackRock）的页脚信息架构。
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
  const columns: {
    title: string;
    links: { key: string; label: string; href: string; external?: boolean }[];
  }[] = [
    {
      title: d.colProduct,
      links: [
        { key: "pricing", label: d.pricing, href: href("/pricing", lang) },
        { key: "demo", label: d.demo, href: href("/demo", lang) },
        { key: "addressCheck", label: d.addressCheck, href: href("/address-check", lang) },
      ],
    },
    {
      title: d.colResources,
      links: [
        { key: "docs", label: d.docs, href: href("/docs", lang) },
        { key: "blog", label: d.blog, href: href("/blog", lang) },
        {
          key: "github",
          label: d.github,
          href: "https://github.com/FintechGuy71/FidesOrigin",
          external: true,
        },
      ],
    },
    {
      title: d.colCompany,
      links: [
        { key: "brand", label: d.brand, href: href("/brand", lang) },
        { key: "contact", label: d.contact, href: "mailto:contact@fidesorigin.com", external: true },
      ],
    },
  ];

  const linkClass =
    "inline-block py-1 text-sm text-[var(--fio-text-3)] transition-colors hover:text-[var(--fio-text)] focus-visible:ring-2 focus-visible:ring-[var(--fio-gold)] focus-visible:outline-none rounded-sm";

  return (
    <footer
      style={{
        background: "var(--fio-ink)",
        borderTop: "1px solid var(--fio-border-hairline)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Upper — brand + link columns */}
        <div className="grid gap-12 py-14 md:grid-cols-12 md:py-16">
          {/* Brand column */}
          <div className="md:col-span-5 lg:col-span-6">
            <div className="flex items-center gap-2.5">
              <img
                src="/brand/logo-icon-56.png"
                alt="FidesOrigin"
                width="26"
                height="26"
                className="rounded-sm border border-[var(--fio-gold-dim)] bg-[var(--fio-gold-glow)]"
              />
              <div className="flex flex-col">
                <span className="font-serif text-sm font-medium leading-none text-[var(--fio-text)]">
                  FidesOrigin
                </span>
                {/* 11px 是可读下限，不再下探（v2 审计结论保持） */}
                <span className="mt-1 font-mono text-[0.6875rem] tracking-wider text-[var(--fio-text-3)]">
                  PROGRAMMABLE COMPLIANCE
                </span>
              </div>
            </div>
            <p
              className="mt-5 max-w-xs text-sm leading-relaxed"
              style={{ color: "var(--fio-text-3)" }}
            >
              {d.tagline}
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <nav
              key={col.title}
              aria-label={col.title}
              className="md:col-span-2 lg:col-span-2"
            >
              <div
                className="mb-4 font-mono text-[0.6875rem] uppercase tracking-widest"
                style={{ color: "var(--fio-text-3)" }}
              >
                {col.title}
              </div>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.key}>
                    {link.external ? (
                      <a
                        href={link.href}
                        {...(link.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className={linkClass}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} prefetch={false} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Lower — legal bar */}
        <div
          className="flex flex-col items-center justify-between gap-3 py-6 sm:flex-row"
          style={{ borderTop: "1px solid var(--fio-border-hairline)" }}
        >
          <div className="font-mono text-xs" style={{ color: "var(--fio-text-3)" }}>
            {d.rights}
          </div>
          <div className="font-mono text-[0.6875rem] tracking-wider" style={{ color: "var(--fio-text-3)" }}>
            {d.license}
          </div>
        </div>
      </div>
    </footer>
  );
}
