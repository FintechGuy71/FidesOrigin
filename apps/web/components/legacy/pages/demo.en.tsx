/* Hand-written: interactive demo page (en). */
import DemoExperience from "@/components/legacy/DemoExperience";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentDemoEN() {
  return <DemoExperience dict={getDictionary("en").demo} />;
}
