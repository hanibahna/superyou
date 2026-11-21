import { store } from "@/lib/config";

export const money = (n: number) => `${store.currencySymbol}${n.toFixed(2)}`;
