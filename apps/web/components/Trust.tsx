import Link from "next/link";
import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";
import { RISK_REGISTRY_ADDRESS, etherscanAddress } from "@/lib/deployment";

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export default function Trust({ d, lang }: { d: Dict["home"]["trust"]; lang: Locale }) {
  const badges = [
    [d.badge1Label, d.badge1Status], [d.badge2Label, d.badge2Status],
    [d.badge3Label, d.badge3Status], [d.badge4Label, d.badge4Status],
  ];
  const coverage = [d.coverage1, d.coverage2, d.coverage3, d.coverage4];
  const links = [
    { label: d.verifyContract, href: etherscanAddress(RISK_REGISTRY_ADDRESS), external: true },
    { label: d.verifySource, href: "https://github.com/FintechGuy71/FidesOrigin", external: true },
    { label: d.verifyDocs, href: localize("/verification", lang), external: false },
  ];

  return (
    <section id="security" className="home-section trust-section">
      <div className="trust-coverage">
        <p>{d.coverageCaption}</p>
        <ul>{coverage.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="home-shell trust-grid">
        <div className="trust-statement">
          <p className="home-caption">{d.quoteRole}</p>
          <blockquote>“{d.quote}”</blockquote>
          <p>{d.quoteName}</p>
        </div>
        <div className="trust-proof">
          <dl>{badges.map(([label, status]) => <div key={label}><dt>{label}</dt><dd>{status}</dd></div>)}</dl>
          <div className="verify-index">
            <h3>{d.verifyCaption}</h3>
            {links.map((link) => link.external ? (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"><span>{link.label}</span><Arrow /></a>
            ) : (
              <Link key={link.label} href={link.href} prefetch={false}><span>{link.label}</span><Arrow /></Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
