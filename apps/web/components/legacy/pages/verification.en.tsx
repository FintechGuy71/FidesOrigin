import VerificationCenter from "@/components/verification-center";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentVerificationEN() {
  const dict = getDictionary("en");
  return <VerificationCenter d={dict.verification} hero={dict.home.hero} lang="en" />;
}
