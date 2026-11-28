import SiteHeader from "@/components/SiteHeader";
import type { Dict } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/locales";

type Props = {
  lang: Locale;
  dict: Dict;
  pagePath: string;
  availableLocales?: readonly Locale[];
  wallet?: boolean;
};

export default function LegacyHeader({ lang, pagePath, availableLocales, wallet }: Props) {
  return <SiteHeader lang={lang} pagePath={pagePath} availableLocales={availableLocales} wallet={wallet} />;
}
