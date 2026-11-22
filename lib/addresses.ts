import { z } from "zod";

// Customers' saved delivery addresses (several each, pinned on a map). Client-safe.
export type Address = { id: string; label: string; zone: string; city: string; address: string; notes?: string; lat?: number; lng?: number };

export const addressSchema = z.object({
  id: z.string().max(40), label: z.string().trim().max(30), zone: z.string().trim().max(60), city: z.string().trim().max(80),
  address: z.string().trim().min(3).max(300), notes: z.string().trim().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
});
export const addressListSchema = z.array(addressSchema).max(10);

export const newAddressId = () => Math.random().toString(36).slice(2, 10);
export const sameAddress = (a: Pick<Address, "address" | "city">, b: Pick<Address, "address" | "city">) =>
  a.address.trim().toLowerCase() === b.address.trim().toLowerCase() && a.city.trim().toLowerCase() === b.city.trim().toLowerCase();

const KEY = "sy:addresses";
export function localAddresses(): Address[] {
  try {
    const v = addressListSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    return v.success ? v.data : [];
  } catch {
    return [];
  }
}
export function saveLocalAddresses(list: Address[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    // private mode
  }
}
/** Adds (or refreshes) one address in this device's book; returns the new list. */
export function rememberAddress(a: Omit<Address, "id" | "label"> & Partial<Pick<Address, "id" | "label">>): Address[] {
  const list = localAddresses();
  const i = list.findIndex((x) => (a.id && x.id === a.id) || sameAddress(x, a));
  const full: Address = { id: a.id || list[i]?.id || newAddressId(), label: a.label || list[i]?.label || (list.length ? "Other" : "Home"), ...a } as Address;
  const next = i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...full } : x)) : [full, ...list];
  saveLocalAddresses(next);
  return next;
}
