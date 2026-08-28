/* Hand-written: interactive demo page (tw). */
import DemoExperience from "@/components/legacy/DemoExperience";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentDemoTW() {
  return <DemoExperience dict={getDictionary("tw").demo} />;
}
