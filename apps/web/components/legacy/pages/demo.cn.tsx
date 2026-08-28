/* Hand-written: interactive demo page (cn). */
import DemoExperience from "@/components/legacy/DemoExperience";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentDemoCN() {
  return <DemoExperience dict={getDictionary("cn").demo} />;
}
