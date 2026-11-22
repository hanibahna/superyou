import "server-only";

import { db } from "@/lib/db";
import { addressListSchema, newAddressId, sameAddress, type Address } from "@/lib/addresses";
import { normPhone } from "@/lib/wa";

// Saved addresses per customer, keyed by their phone number.
const key = (phone: string) => `addr:${normPhone(phone) || phone}`;

export async function getAddresses(phone: string): Promise<Address[]> {
  try {
    const raw = await db.cmd<string | null>(["GET", key(phone)]);
    const v = addressListSchema.safeParse(raw ? JSON.parse(raw) : []);
    return v.success ? v.data : [];
  } catch {
    return [];
  }
}
export async function saveAddresses(phone: string, list: Address[]) {
  await db.cmd(["SET", key(phone), JSON.stringify(list.slice(0, 10))]);
}
/** After an order: keep the address it went to (new ones go first, same street refreshes the pin). */
export async function rememberServerAddress(phone: string, a: Omit<Address, "id" | "label">) {
  const list = await getAddresses(phone);
  const i = list.findIndex((x) => sameAddress(x, a));
  if (i >= 0) list[i] = { ...list[i], ...a, lat: a.lat ?? list[i].lat, lng: a.lng ?? list[i].lng };
  else list.unshift({ id: newAddressId(), label: list.length ? "Other" : "Home", ...a });
  await saveAddresses(phone, list);
}
