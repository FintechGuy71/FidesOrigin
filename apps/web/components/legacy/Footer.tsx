import Link from "next/link";

import { Locale, langPrefix, localize } from "@/i18n/locales";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   LEGACY FOOTER — classic static-site footer, dictionary-driven.
   ================================================================ */

type Props = { lang: Locale; dict: Dict };

/* ⚠ 全站 URL 一律不带尾斜杠（详见 components/ui/header.tsx 顶部注释）：
   静态导出未开 trailingSlash，out/ 下是 docs.html 而不是 docs/index.html。
   唯一例外是 /admin/ —— 它是 public/admin/ 目录，静态托管按目录索引解析。 */
function homeHref(lang: Locale): string {
  return langPrefix(lang) || "/";
}

export default function LegacyFooter({ lang, dict }: Props) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href={homeHref(lang)} className="nav-logo">
              <img
                src="/brand/logo-dark-icon.png"
                alt="FidesOrigin"
                className="nav-logo-icon"
                width={28}
                height={28}
                loading="lazy"
              />
              FidesOrigin
            </a>
            <p>{dict.footer.tagline}</p>
          </div>
          <div className="footer-col">
            <h4>{dict.footer.product}</h4>
            {/* #features 是同页锚点，保留原生 <a>；其余站内链接改 next/link（R2-049） */}
            <a href={`${homeHref(lang)}#features`}>{dict.footer.features}</a>
            <Link href={localize("/use-cases/stablecoin-compliance", lang)} prefetch={false}>{dict.footer.useCases}</Link>
            <Link href={localize("/pricing", lang)} prefetch={false}>{dict.footer.pricing}</Link>
            <Link href={localize("/security", lang)} prefetch={false}>{dict.footer.security}</Link>
            <Link href="/admin/dashboard" prefetch={false}>{dict.footer.dashboard}</Link>
          </div>
          <div className="footer-col">
            <h4>{dict.footer.developers}</h4>
            <Link href={localize("/docs", lang)} prefetch={false}>{dict.footer.documentation}</Link>
            <Link href={localize("/docs/api", lang)} prefetch={false}>{dict.footer.apiReference}</Link>
            <Link href={localize("/docs/sdk", lang)} prefetch={false}>SDK</Link>
            {/* [AUDIT FIX R1-X2] /address-check（四语言，带钱包链上合规查询的
                核心功能页）此前是孤儿页：全站无任何链接可达，只能靠 sitemap/
                直接输入 URL。加入 footer Developers 列使其可发现。 */}
            <Link href={localize("/address-check", lang)} prefetch={false}>{dict.footer.addressCheck}</Link>
            <a
              href="https://github.com/FintechGuy71/FidesOrigin"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
          <div className="footer-col">
            <h4>{dict.footer.company}</h4>
            <a href="mailto:contact@fidesorigin.com">{dict.footer.contact}</a>
            <Link href={localize("/blog", lang)} prefetch={false}>{dict.footer.blog}</Link>
            <Link href={localize("/privacy", lang)} prefetch={false}>{dict.footer.privacy}</Link>
            <Link href={localize("/terms", lang)} prefetch={false}>{dict.footer.terms}</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>{dict.footer.rights}</p>
          <p>{dict.footer.builtFor}</p>
        </div>
      </div>
    </footer>
  );
}
