/* Hand-written: interactive demo page (jp). */
import DemoExperience from "@/components/legacy/DemoExperience";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentDemoJP() {
  return <DemoExperience dict={getDictionary("jp").demo} />;
}
