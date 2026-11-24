import VerificationCenter from "@/components/verification-center";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentVerificationTW() {
  const dict = getDictionary("tw");
  return <VerificationCenter d={dict.verification} hero={dict.home.hero} lang="tw" />;
}
