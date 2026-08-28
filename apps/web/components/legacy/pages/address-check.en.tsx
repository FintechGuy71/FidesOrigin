/* Hand-written: real address risk check (en). */
import AddressCheck from "@/components/legacy/AddressCheck";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentAddressCheckEN() {
  return <AddressCheck dict={getDictionary("en").addressCheck} />;
}
