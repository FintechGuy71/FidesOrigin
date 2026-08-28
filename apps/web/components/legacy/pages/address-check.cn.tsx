/* Hand-written: real address risk check (cn). */
import AddressCheck from "@/components/legacy/AddressCheck";
import { getDictionary } from "@/i18n/dictionaries";

export default function ContentAddressCheckCN() {
  return <AddressCheck dict={getDictionary("cn").addressCheck} />;
}
