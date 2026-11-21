"use client";

import { useT } from "@/lib/site-context";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Loads the MPGS checkout.js served by areeba's gateway and opens the hosted payment page.
function AreebaPay() {
  const tx = useT();
  const sp = useSearchParams();
  const [error, setError] = useState("");
  useEffect(() => {
    const session = sp.get("session");
    const host = sp.get("host");
    if (!session || !host || !/^https:\/\/[a-z0-9.-]+$/i.test(host)) return setError("Invalid payment session.");
    const s = document.createElement("script");
    s.src = `${host}/static/checkout/checkout.min.js`;
    s.onload = () => {
      const Checkout = (window as unknown as { Checkout: { configure: (c: object) => void; showPaymentPage: () => void } }).Checkout;
      Checkout.configure({ session: { id: session } });
      Checkout.showPaymentPage();
    };
    s.onerror = () => setError("Couldn't reach the payment gateway.");
    document.body.appendChild(s);
  }, [sp]);
  return <p className="text-muted">{error || tx("Redirecting you to the secure payment page…")}</p>;
}

export default function Page() {
  return (
    <div className="container-x py-24 text-center">
      <Suspense>
        <AreebaPay />
      </Suspense>
    </div>
  );
}
