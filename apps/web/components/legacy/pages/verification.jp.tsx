import VerificationCenter from "@/components/verification-center";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentVerificationJP() {
  const dict = getDictionary("jp");
  return <VerificationCenter d={dict.verification} hero={dict.home.hero} lang="jp" />;
}
