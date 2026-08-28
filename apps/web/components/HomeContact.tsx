"use client";

import type { Dict } from "@/i18n/dictionaries/en";
import { langPrefix, type Locale } from "@/i18n/locales";

/* ================================================================
   HOME CONTACT — final CTA band (#contact anchor target for the
   classic pages' Get-Started links in non-EN locales).
   ================================================================ */

export default function HomeContact({
  d,
  lang,
}: {
  d: Dict["home"]["contact"];
  lang: Locale;
}) {
  const prefix = langPrefix(lang);
  return (
    <section id="contact" style={{ background: "var(--fio-ink-soft)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="border-t py-24 text-center md:py-32"
          style={{ borderColor: "rgba(255,255,255,0.04)" }}
        >
          <div className="fio-caption mb-4" data-aos="fade-up">
            {d.caption}
          </div>
          <h2
            className="fio-heading-lg mb-5"
            style={{ color: "var(--fio-text)" }}
            data-aos="fade-up"
            data-aos-delay={100}
          >
            {d.title}
          </h2>
          <p
            className="fio-body-lg mx-auto max-w-xl"
            data-aos="fade-up"
            data-aos-delay={200}
          >
            {d.body}
          </p>
          <div
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            data-aos="fade-up"
            data-aos-delay={300}
          >
            <a href="mailto:contact@fidesorigin.com" className="fio-btn fio-btn-primary group">
              {d.ctaPrimary}
              <svg
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
            <a href={`${prefix}/docs/`} className="fio-btn fio-btn-ghost">
              {d.ctaDocs}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
