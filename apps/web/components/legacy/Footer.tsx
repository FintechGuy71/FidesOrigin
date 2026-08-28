import { Locale, langPrefix, localize } from "@/i18n/locales";
import type { Dict } from "@/i18n/dictionaries/en";

/* ================================================================
   LEGACY FOOTER — classic static-site footer, dictionary-driven.
   ================================================================ */

type Props = { lang: Locale; dict: Dict };

export default function LegacyFooter({ lang, dict }: Props) {
  const prefix = langPrefix(lang);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href={`${prefix}/`} className="nav-logo">
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
            <a href={`${prefix}/#features`}>{dict.footer.features}</a>
            <a href={localize("/use-cases/stablecoin-compliance", lang)}>{dict.footer.useCases}</a>
            <a href={localize("/pricing", lang)}>{dict.footer.pricing}</a>
            <a href={localize("/security", lang)}>{dict.footer.security}</a>
            <a href="/admin/">{dict.footer.dashboard}</a>
          </div>
          <div className="footer-col">
            <h4>{dict.footer.developers}</h4>
            <a href={`${localize("/docs", lang)}/`}>{dict.footer.documentation}</a>
            <a href={localize("/docs/api", lang)}>{dict.footer.apiReference}</a>
            <a href={localize("/docs/sdk", lang)}>SDK</a>
            <a href="https://github.com/FintechGuy71/FidesOrigin" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
          <div className="footer-col">
            <h4>{dict.footer.company}</h4>
            <a href="mailto:contact@fidesorigin.com">{dict.footer.contact}</a>
            <a href={`${localize("/blog", lang)}/`}>{dict.footer.blog}</a>
            <a href={localize("/privacy", lang)}>{dict.footer.privacy}</a>
            <a href={localize("/terms", lang)}>{dict.footer.terms}</a>
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
