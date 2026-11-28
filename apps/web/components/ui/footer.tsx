import SiteFooter from "@/components/SiteFooter";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";

export default function Footer({ lang }: { lang: Locale; d: Dict["home"]["chrome"] }) {
  return <SiteFooter lang={lang} />;
}
