/* Hand-written: real address risk check (tw). */
import AddressCheck from "@/components/legacy/AddressCheck";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentAddressCheckTW() {
  return <AddressCheck dict={getDictionary("tw").addressCheck} />;
}
