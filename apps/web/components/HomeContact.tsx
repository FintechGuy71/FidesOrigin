import Link from "next/link";
import type { Dict } from "@/i18n/dictionaries/en";
import { localize, type Locale } from "@/i18n/locales";

export default function HomeContact({ d, lang }: { d: Dict["home"]["contact"]; lang: Locale }) {
  return (
    <section id="contact" className="home-contact">
      <div className="home-shell home-contact-grid">
        <div>
          <p className="home-caption">{d.caption}</p>
          <h2>{d.title}</h2>
        </div>
        <div className="home-contact-action">
          <p>{d.body}</p>
          <div>
            <Link href="/contact" className="fio-btn fio-btn-primary">{d.ctaPrimary}<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg></Link>
            <Link href={localize("/docs", lang)} className="origin-text-link">{d.ctaDocs}<span aria-hidden="true">↗</span></Link>
          </div>
          <a href="mailto:contact@fidesorigin.com">contact@fidesorigin.com</a>
        </div>
      </div>
    </section>
  );
}
