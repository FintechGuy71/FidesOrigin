import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { getDictionary } from "@/i18n/dictionaries";
import { langPrefix, localize, type Locale } from "@/i18n/locales";

type LinkDef = { label: string; href: string; external?: boolean };
type Props = { lang: Locale };

export default function SiteFooter({ lang }: Props) {
  const dict = getDictionary(lang);
  const d = dict.home.chrome;
  const home = langPrefix(lang) || "/";
  const columns: { title: string; links: LinkDef[] }[] = [
    { title: d.colProduct, links: [
      { label: d.pricing, href: localize("/pricing", lang) },
      { label: d.demo, href: localize("/demo", lang) },
      { label: d.addressCheck, href: localize("/address-check", lang) },
      { label: d.dashboard, href: "/admin/dashboard" },
    ] },
    { title: d.colResources, links: [
      { label: d.docs, href: localize("/docs", lang) },
      { label: dict.footer.apiReference, href: localize("/docs/api", lang) },
      { label: "SDK", href: localize("/docs/sdk", lang) },
      { label: d.github, href: "https://github.com/FintechGuy71/FidesOrigin", external: true },
    ] },
    { title: d.colCompany, links: [
      { label: d.blog, href: localize("/blog", lang) },
      { label: d.brand, href: localize("/brand", lang) },
      { label: d.contact, href: "mailto:contact@fidesorigin.com", external: true },
      { label: dict.nav.features, href: `${home}#features` },
    ] },
  ];

  const renderLink = (link: LinkDef) => link.external ? (
    <a href={link.href} {...(link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link.label}</a>
  ) : <Link href={link.href} prefetch={false}>{link.label}</Link>;

  return (
    <footer className="site-footer footer">
      <div className="site-footer-inner">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href={home} className="site-brand"><BrandMark /><span>FidesOrigin<small>PROGRAMMABLE COMPLIANCE</small></span></Link>
            <p>{d.tagline}</p>
          </div>
          {columns.map((column) => <nav key={column.title} aria-label={column.title} className="site-footer-column"><h2>{column.title}</h2>{column.links.map((link) => <div key={link.label}>{renderLink(link)}</div>)}</nav>)}
        </div>
        <div className="site-footer-bottom">
          <p>{d.rights}</p>
          <nav aria-label="Legal"><Link href={localize("/privacy", lang)} prefetch={false}>{d.privacy}</Link><Link href={localize("/terms", lang)} prefetch={false}>{d.terms}</Link><Link href={localize("/security", lang)} prefetch={false}>{d.security}</Link></nav>
          <p>{d.license}</p>
        </div>
      </div>
    </footer>
  );
}
