import { DEMO_MODE } from "@/lib/config";
import { checkoutMethods, methodInfo, type MethodId } from "@/lib/payments";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Checkout", robots: { index: false, follow: true } };

export default async function CheckoutPage() {
  const methods = DEMO_MODE ? (["cod", "card", "whish"] as MethodId[]).map((id) => ({ id, ...methodInfo[id] })) : await checkoutMethods();
  return <CheckoutForm methods={methods} />;
}
