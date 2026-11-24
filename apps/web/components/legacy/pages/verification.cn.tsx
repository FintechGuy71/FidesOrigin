import VerificationCenter from "@/components/verification-center";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentVerificationCN() {
  const dict = getDictionary("cn");
  return <VerificationCenter d={dict.verification} hero={dict.home.hero} lang="cn" />;
}
