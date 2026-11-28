import SiteHeader from "@/components/SiteHeader";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";

export default function Header({ lang }: { lang: Locale; d: Dict["home"]["chrome"] }) {
  return <SiteHeader lang={lang} />;
}
