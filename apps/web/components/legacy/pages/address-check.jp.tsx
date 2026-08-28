/* Hand-written: real address risk check (jp). */
import AddressCheck from "@/components/legacy/AddressCheck";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentAddressCheckJP() {
  return <AddressCheck dict={getDictionary("jp").addressCheck} />;
}
