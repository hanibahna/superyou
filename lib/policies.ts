import "server-only";

// SuperYou's own policy pages. Pages copied from a supplier's site (their phone number, their
// stores, their notices) are replaced by these. Edit a page in Admin → Settings → Pages to use your
// own wording instead: once it no longer contains supplier details, your text is shown.

import type { Settings } from "@/lib/site";

const money = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

/** Supplier names, their phone numbers, stores, and leftover website code. */
export const foreignText = /skin\s*society|neo\s*vitale|950\s*333|5\s*950|hazmieh|dbayeh|@skinsociety|shopify|<div|fragile health situation/i;

export function policyText(slug: string, s: Settings): { title: string; body: string } | null {
  const st = s.store;
  const d = s.delivery;
  const contact = [st.phone && `• Phone / WhatsApp: ${st.phone}`, st.email && `• Email: ${st.email}`].filter(Boolean).join("\n");
  const fees = `Delivery costs ${money(d.fee)}${d.freeThreshold ? ` and is free on orders over ${money(d.freeThreshold)}` : ""}${d.zones.some((z) => z.fee !== undefined) ? " (some areas have their own fee, shown at checkout)" : ""}.`;
  switch (slug) {
    case "return-policy":
      return {
        title: "Return policy",
        body: `Return policy
We want you to love what you ordered. If something isn't right, we'll make it right.

Wrong, damaged or faulty items
If you received the wrong product, or it arrived damaged or faulty, contact us within 48 hours of delivery with your order number and a photo. We'll replace it or refund you in full, and collect it at no cost to you.

Changed your mind
You can return an unopened, unused product in its original packaging and seal within 7 days of delivery. We refund the product price; the delivery fee is not refunded unless the item was wrong or damaged.

What we can't take back
For hygiene and safety reasons we can't accept returns of opened or used skin care, make up, fragrances, hair care, medicines, supplements, baby feeding items, or anything with a broken seal, unless it is faulty.

How refunds are paid
• Cash on delivery: refunded in cash or as SuperYou store credit (a gift card), your choice.
• Card: refunded to the same card. Banks usually take 5–10 working days to show it.
• Whish: refunded to the same Whish account.

How to start a return
${contact}
Tell us your order number and what you'd like to return.`,
      };
    case "delivery-terms":
      return {
        title: "Delivery terms",
        body: `Delivery terms
We deliver across Lebanon.

Fees and timing
${fees}
${d.estimate}

Paying
You can pay cash on delivery, or online by card or Whish when available at checkout. Please have the exact amount ready for cash orders if you can.

On delivery
Please check your parcel when it arrives. If anything is missing or damaged, tell the driver and contact us within 48 hours.

If we can't reach you
Our driver will call before arriving. If we can't reach you after two attempts, we'll contact you to arrange a new time; a second delivery may be charged.

Questions
${contact}`,
      };
    case "privacy-policy":
      return {
        title: "Privacy policy",
        body: `Privacy policy
This policy explains what personal information SuperYou collects and how we use it.

What we collect
• Your name, mobile number, email and delivery address when you order or sign up.
• Your orders, reviews, wishlist and SuperYou Club points.
• Your answers when you use our beauty tools (skin scan, shade finder, routine finder).
• Basic technical information (device, pages visited) to keep the shop working and improve it.

How we use it
• To deliver your orders and keep you updated, including by WhatsApp.
• To run SuperYou Club, gift cards and customer service.
• To send offers only if you agreed to receive them. You can stop them at any time by replying STOP or asking us.

Payments
Card payments are handled by our payment provider; SuperYou never sees or stores your full card number.

Sharing
We never sell your information. We share only what's needed with the people who help us serve you: delivery companies, payment providers and messaging services.

Your choices
You can ask us to show, correct or delete your information at any time.
${contact}`,
      };
    case "terms-conditions":
      return {
        title: "Terms & conditions",
        body: `Terms & conditions
These terms apply when you shop at SuperYou${st.name && st.name !== "SuperYou" ? ` (${st.name})` : ""}.

Products and prices
All products are 100% authentic. Prices are in US dollars and include VAT where applicable. We try to keep stock and prices accurate; if a product is unavailable or a price is shown in error, we'll contact you before delivering and you can cancel.

Orders
Your order is confirmed when we accept it. We may cancel an order if a product is out of stock, a payment fails, or we can't reach you to confirm delivery.

Delivery and returns
See our delivery terms and return policy.

Offers, gift cards and SuperYou Club
Discount codes, gift cards and Club rewards follow the conditions shown with them. Gift cards are used like money at checkout and can't be exchanged for cash. Points and rewards have no cash value.

Health advice
Advice from our pharmacists and our beauty tools is general guidance and doesn't replace a consultation with your doctor.

Contact
${contact}`,
      };
    default:
      return null;
  }
}
