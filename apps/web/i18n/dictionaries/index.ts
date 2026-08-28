import type { Locale } from "../locales";
import type { Dict } from "./en";
import en from "./en";
import cn from "./cn";
import tw from "./tw";
import jp from "./jp";

const dictionaries: Record<Locale, Dict> = { en, cn, tw, jp };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? en;
}
