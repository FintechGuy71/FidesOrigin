import SiteFooter from "@/components/SiteFooter";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";

export default function LegacyFooter({ lang }: { lang: Locale; dict: Dict }) {
  return <SiteFooter lang={lang} />;
}
