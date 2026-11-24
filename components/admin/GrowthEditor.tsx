"use client";

import { useState } from "react";
import { BADGES, type Growth } from "@/lib/growth";
import { PriceMatchReport } from "./PriceMatchReport";
import { Area, Card, Header, ListInput, MediaField, Num, ProductPicker, Select, Text, Toggle, useSaver } from "./fields";

const TABS = ["SuperPrime", "Price match", "Gamification", "Sign-up pop-up", "Samples & cart", "Reviews", "Club", "Pharmacist & trust", "Advent calendar", "Tools", "Look, motion & duplicates"] as const;

export function GrowthEditor({ initial, aiReady, emailReady }: { initial: Growth; aiReady: boolean; emailReady: boolean }) {
  const [g, setG] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const saver = useSaver("/api/admin/growth/");
  const up = <K extends keyof Growth>(k: K, patch: Partial<Growth[K]>) => (saver.touch(), setG((x) => ({ ...x, [k]: { ...(x[k] as object), ...patch } })));

  return (
    <div>
      <Header title="Growth & loyalty" sub="Sign-up offers, free samples, reviews, the loyalty club, pharmacist chat, routine bundles, reminders and more." saver={saver} onSave={() => saver.save(g)} />
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-ink text-white" : "bg-white"}`}>{t}</button>)}
      </div>

      {tab === "Sign-up pop-up" && (
        <div className="space-y-5">
          <Card title="Welcome offer" sub="New visitors get a personal one-time code for their email or WhatsApp number. Each person can only get one welcome code.">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Show the pop-up" checked={g.popup.enabled} onChange={(enabled) => up("popup", { enabled })} />
              <Select label="Style" value={g.popup.mode} onChange={(mode) => up("popup", { mode })} options={[["classic", "Classic: fixed % off"], ["wheel", "Spin-to-win wheel (good for Black Friday)"]]} />
              <Text label="Title" value={g.popup.title} onChange={(title) => up("popup", { title })} />
              <Num label="Discount % (classic)" value={g.popup.percent} onChange={(percent) => up("popup", { percent })} />
              <Area label="Text" value={g.popup.text} onChange={(text) => up("popup", { text })} className="md:col-span-2" />
              <MediaField label="Image (left side, optional)" value={g.popup.image} onChange={(image) => up("popup", { image })} />
              <div className="grid grid-cols-2 gap-3">
                <Num label="Show after (seconds)" value={g.popup.delaySeconds} onChange={(delaySeconds) => up("popup", { delaySeconds })} />
                <Num label="…or after scrolling (%)" value={g.popup.scrollPercent} onChange={(scrollPercent) => up("popup", { scrollPercent })} />
                <Num label="Code valid for (days)" value={g.popup.validDays} onChange={(validDays) => up("popup", { validDays })} />
                <Num label="Minimum order ($)" value={g.popup.minSubtotal} onChange={(minSubtotal) => up("popup", { minSubtotal })} />
              </div>
              <Toggle label="Permanent tab on the side of the screen" hint="Visitors who closed the pop-up can open it again — these convert best." checked={g.popup.tab} onChange={(tab) => up("popup", { tab })} />
              <Text label="Tab label" value={g.popup.tabLabel} onChange={(tabLabel) => up("popup", { tabLabel })} />
            </div>
            <p className="mt-3 text-xs text-muted">Shown at most once a week, never to people who already signed up, never on checkout. Codes are sent on WhatsApp (automation "Welcome discount code") and by email when email sending is set up {emailReady ? "(email is on)" : "(set RESEND_API_KEY and EMAIL_FROM in Vercel to send emails)"}.</p>
          </Card>
          {g.popup.mode === "wheel" && (
            <Card title="Wheel slices" sub="Every spin wins. Chance = weight ÷ total of all weights. The server picks the result.">
              {g.popup.wheel.map((w, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_100px_100px_40px] items-end gap-2">
                  <Text label={i ? "" : "Label"} value={w.label} onChange={(label) => up("popup", { wheel: g.popup.wheel.map((x, j) => (j === i ? { ...x, label } : x)) })} />
                  <Num label={i ? "" : "% off"} value={w.percent} onChange={(percent) => up("popup", { wheel: g.popup.wheel.map((x, j) => (j === i ? { ...x, percent } : x)) })} />
                  <Num label={i ? "" : "Weight"} value={w.weight} onChange={(weight) => up("popup", { wheel: g.popup.wheel.map((x, j) => (j === i ? { ...x, weight } : x)) })} />
                  <button onClick={() => up("popup", { wheel: g.popup.wheel.filter((_, j) => j !== i) })} className="pb-2 text-sale" aria-label="Remove">✕</button>
                </div>
              ))}
              <button onClick={() => up("popup", { wheel: [...g.popup.wheel, { label: "5% off", percent: 5, weight: 10 }] })} className="mt-2 text-sm font-semibold text-brand-600">+ Add slice</button>
            </Card>
          )}
          <Card title="Leaving with items in the bag" sub="On computers, when the mouse heads for the close button with items in the bag (once per visit).">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Show the cart-exit offer" checked={g.popup.cartExit} onChange={(cartExit) => up("popup", { cartExit })} />
              <Num label="Extra % off (0 = use the welcome %)" value={g.popup.cartExitPercent} onChange={(cartExitPercent) => up("popup", { cartExitPercent })} />
              <Text label="Headline" value={g.popup.cartExitText} onChange={(cartExitText) => up("popup", { cartExitText })} className="md:col-span-2" />
            </div>
          </Card>
        </div>
      )}

      {tab === "Samples & cart" && (
        <div className="space-y-5">
          <Card title="Free samples" sub="Customers choose samples in the cart. Pick the sample products (minis, sachets).">
            <div className="grid gap-4 md:grid-cols-3">
              <Toggle label="Offer free samples" checked={g.samples.enabled} onChange={(enabled) => up("samples", { enabled })} />
              <Text label="Title" value={g.samples.title} onChange={(title) => up("samples", { title })} />
              <div className="grid grid-cols-2 gap-3">
                <Num label="How many" value={g.samples.pick} onChange={(pick) => up("samples", { pick })} />
                <Num label="From order of ($)" value={g.samples.minSubtotal} onChange={(minSubtotal) => up("samples", { minSubtotal })} />
              </div>
            </div>
            <div className="mt-4"><ProductPicker label="Sample products" value={g.samples.skus} onChange={(skus) => up("samples", { skus })} max={40} /></div>
            {g.samples.skus.length === 0 && <p className="mt-2 text-xs text-sale">Add at least a few sample products, otherwise nothing is shown.</p>}
          </Card>
          <Card title="Cart">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Free-delivery progress bar" hint="“$8.50 away from free delivery” on the cart page." checked={g.freeDeliveryBar} onChange={(freeDeliveryBar) => (saver.touch(), setG({ ...g, freeDeliveryBar }))} />
              <div />
              <Toggle label="Routine set discount" hint="Items from several routine steps (cleanser, serum, SPF…) in one order get an extra discount." checked={g.bundles.enabled} onChange={(enabled) => up("bundles", { enabled })} />
              <div className="grid grid-cols-2 gap-3">
                <Num label="Steps needed" value={g.bundles.minSteps} onChange={(minSteps) => up("bundles", { minSteps })} />
                <Num label="% off those items" value={g.bundles.percent} onChange={(percent) => up("bundles", { percent })} />
              </div>
            </div>
          </Card>
          <Card title="Restock reminders" sub="After an order is delivered, a WhatsApp message (automation “Time to restock”) reminds the customer when the product is likely running out. Only to customers who accepted offers.">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Send restock reminders" checked={g.reorder.enabled} onChange={(enabled) => up("reorder", { enabled })} />
              <Num label="Default: days after delivery" value={g.reorder.defaultDays} onChange={(defaultDays) => up("reorder", { defaultDays })} />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {g.reorder.days.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_30px] items-end gap-2">
                  <Text label={i ? "" : "Category slug"} value={d.category} onChange={(category) => up("reorder", { days: g.reorder.days.map((x, j) => (j === i ? { ...x, category } : x)) })} />
                  <Num label={i ? "" : "Days"} value={d.days} onChange={(days) => up("reorder", { days: g.reorder.days.map((x, j) => (j === i ? { ...x, days } : x)) })} />
                  <button onClick={() => up("reorder", { days: g.reorder.days.filter((_, j) => j !== i) })} className="pb-2 text-sale">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => up("reorder", { days: [...g.reorder.days, { category: "", days: 60 }] })} className="mt-2 text-sm font-semibold text-brand-600">+ Add category</button>
          </Card>
        </div>
      )}

      {tab === "Reviews" && (
        <Card title="Ratings & reviews" sub="Moderate reviews in Marketing → Reviews.">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Reviews on product pages" checked={g.reviews.enabled} onChange={(enabled) => up("reviews", { enabled })} />
            <Toggle label="Stars on product cards" checked={g.reviews.showOnCards} onChange={(showOnCards) => up("reviews", { showOnCards })} />
            <Toggle label="Publish without checking" hint="Off = you approve each review first (recommended)." checked={g.reviews.autoApprove} onChange={(autoApprove) => up("reviews", { autoApprove })} />
            <Toggle label="Ask for a review on WhatsApp a day after delivery" hint="Uses the “Review request” automation. Reviews from that link are marked Verified buyer." checked={g.reviews.askAfterDelivery} onChange={(askAfterDelivery) => up("reviews", { askAfterDelivery })} />
          </div>
        </Card>
      )}

      {tab === "Club" && (
        <div className="space-y-5">
          <Card title="Loyalty club" sub="Points on delivered orders. Every block of points becomes a voucher code sent on WhatsApp — no passwords, no app.">
            <div className="grid gap-4 md:grid-cols-3">
              <Toggle label="Club is open" checked={g.club.enabled} onChange={(enabled) => up("club", { enabled })} />
              <Text label="Club name" value={g.club.name} onChange={(name) => up("club", { name })} />
              <Num label="Points per $1" value={g.club.pointsPerDollar} step={0.5} onChange={(pointsPerDollar) => up("club", { pointsPerDollar })} />
              <Num label="Points for a voucher" value={g.club.rewardPoints} onChange={(rewardPoints) => up("club", { rewardPoints })} />
              <Num label="Voucher value ($)" value={g.club.rewardValue} onChange={(rewardValue) => up("club", { rewardValue })} />
              <Num label="Birthday % off (0 = off)" value={g.club.birthdayPercent} onChange={(birthdayPercent) => up("club", { birthdayPercent })} />
            </div>
            <p className="mt-3 text-xs text-muted">Example: {g.club.pointsPerDollar} pt per $1 and a ${g.club.rewardValue} voucher every {g.club.rewardPoints} points = {((g.club.rewardValue / Math.max(1, g.club.rewardPoints)) * g.club.pointsPerDollar * 100).toFixed(1)}% back.</p>
          </Card>
          <Card title="Bonus points" sub="One-off extras on top of points for orders. Reviews count only when they come from an order link and you approve them.">
            <div className="grid gap-4 md:grid-cols-4">
              <Num label="Joining" value={g.club.bonus.join} onChange={(join) => up("club", { bonus: { ...g.club.bonus, join } })} />
              <Num label="First order" value={g.club.bonus.firstOrder} onChange={(firstOrder) => up("club", { bonus: { ...g.club.bonus, firstOrder } })} />
              <Num label="Review" value={g.club.bonus.review} onChange={(review) => up("club", { bonus: { ...g.club.bonus, review } })} />
              <Num label="Review with photo" value={g.club.bonus.photoReview} onChange={(photoReview) => up("club", { bonus: { ...g.club.bonus, photoReview } })} />
              <Num label="Points expire after (months without an order, 0 = never)" value={g.club.expiryMonths} onChange={(expiryMonths) => up("club", { expiryMonths })} />
            </div>
          </Card>
          <Card title="Refer a friend" sub="Each member gets a code like REF-RANA7K and a link to share. The friend gets money off their first order; the member gets points once it's delivered.">
            <div className="grid gap-4 md:grid-cols-4">
              <Toggle label="Referrals on" checked={g.club.referral.enabled} onChange={(enabled) => up("club", { referral: { ...g.club.referral, enabled } })} />
              <Num label="Friend gets ($ off)" value={g.club.referral.friendAmount} onChange={(friendAmount) => up("club", { referral: { ...g.club.referral, friendAmount } })} />
              <Num label="…on orders from ($)" value={g.club.referral.friendMinSubtotal} onChange={(friendMinSubtotal) => up("club", { referral: { ...g.club.referral, friendMinSubtotal } })} />
              <Num label="Member earns (points)" value={g.club.referral.referrerPoints} onChange={(referrerPoints) => up("club", { referral: { ...g.club.referral, referrerPoints } })} />
            </div>
          </Card>
          <Card title="Member prices" sub="Members get an extra % off at checkout, recognised by their phone number.">
            <div className="grid gap-4 md:grid-cols-3">
              <Toggle label="Member prices on" checked={g.club.memberPrice.enabled} onChange={(enabled) => up("club", { memberPrice: { ...g.club.memberPrice, enabled } })} />
              <Num label="% off" value={g.club.memberPrice.percent} onChange={(percent) => up("club", { memberPrice: { ...g.club.memberPrice, percent } })} />
              <Text label="Only this collection (empty = everything)" value={g.club.memberPrice.collection} onChange={(collection) => up("club", { memberPrice: { ...g.club.memberPrice, collection: collection.replace(/^\/?collections\//, "").replace(/\/$/, "") } })} placeholder="e.g. value-deals" />
            </div>
          </Card>
          <Card title="Tiers" sub="By spend over the last 12 months. The multiplier boosts points.">
            {g.club.tiers.map((t, i) => (
              <div key={i} className="mb-3 grid gap-2 md:grid-cols-[140px_120px_100px_1fr_30px] md:items-end">
                <Text label={i ? "" : "Name"} value={t.name} onChange={(name) => up("club", { tiers: g.club.tiers.map((x, j) => (j === i ? { ...x, name } : x)) })} />
                <Num label={i ? "" : "From $ / year"} value={t.minSpend} onChange={(minSpend) => up("club", { tiers: g.club.tiers.map((x, j) => (j === i ? { ...x, minSpend } : x)) })} />
                <Num label={i ? "" : "Points ×"} value={t.multiplier} step={0.05} onChange={(multiplier) => up("club", { tiers: g.club.tiers.map((x, j) => (j === i ? { ...x, multiplier } : x)) })} />
                <Text label={i ? "" : "Perks (separate with ·)"} value={t.perks} onChange={(perks) => up("club", { tiers: g.club.tiers.map((x, j) => (j === i ? { ...x, perks } : x)) })} />
                <button onClick={() => up("club", { tiers: g.club.tiers.filter((_, j) => j !== i) })} className="pb-2 text-sale">✕</button>
              </div>
            ))}
            <button onClick={() => up("club", { tiers: [...g.club.tiers, { name: "New tier", minSpend: 1500, multiplier: 2, perks: "" }] })} className="text-sm font-semibold text-brand-600">+ Add tier</button>
          </Card>
        </div>
      )}

      {tab === "Pharmacist & trust" && (
        <div className="space-y-5">
          <Card title="Ask a pharmacist" sub="WhatsApp button on every product page, the routine finder and the skin scan, pre-filled with the product name.">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Show the button" checked={g.pharmacist.enabled} onChange={(enabled) => up("pharmacist", { enabled })} />
              <Text label="Button label" value={g.pharmacist.label} onChange={(label) => up("pharmacist", { label })} />
              <Text label="Pharmacist WhatsApp number" hint="Empty = the shop's WhatsApp number (Settings)." value={g.pharmacist.whatsapp} onChange={(whatsapp) => up("pharmacist", { whatsapp })} placeholder="961…" />
              <Text label="Hours" value={g.pharmacist.hours} onChange={(hours) => up("pharmacist", { hours })} />
            </div>
          </Card>
          <Card title="Trust next to the buy button">
            <ListInput label="Lines (one per line)" rows={4} value={g.trust.lines} onChange={(lines) => up("trust", { lines })} />
            <div className="mt-4"><Area label="Returns in one sentence" value={g.trust.returnsSummary} onChange={(returnsSummary) => up("trust", { returnsSummary })} /></div>
          </Card>
        </div>
      )}

      {tab === "Advent calendar" && (
        <Card title="Advent calendar" sub="Page /advent/: one door opens each day of December (Beirut time). Future doors stay secret until their day.">
          <div className="grid gap-4 md:grid-cols-3">
            <Toggle label="Calendar is live" checked={g.advent.enabled} onChange={(enabled) => up("advent", { enabled })} />
            <Num label="Year" value={g.advent.year} onChange={(year) => up("advent", { year })} />
            <Text label="Title" value={g.advent.title} onChange={(title) => up("advent", { title })} />
            <Area label="Intro" value={g.advent.intro} onChange={(intro) => up("advent", { intro })} className="md:col-span-3" />
          </div>
          <div className="mt-5 space-y-3">
            {g.advent.doors.map((d, i) => (
              <details key={d.day} className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm font-semibold">Day {d.day} · {d.title || "—"} {d.code ? `· code ${d.code}` : ""}</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Text label="Title" value={d.title} onChange={(title) => up("advent", { doors: g.advent.doors.map((x, j) => (j === i ? { ...x, title } : x)) })} />
                  <Text label="Code (create it in Discounts)" value={d.code} onChange={(code) => up("advent", { doors: g.advent.doors.map((x, j) => (j === i ? { ...x, code: code.toUpperCase() } : x)) })} />
                  <Text label="Link" value={d.href} onChange={(href) => up("advent", { doors: g.advent.doors.map((x, j) => (j === i ? { ...x, href } : x)) })} />
                  <MediaField label="Image" value={d.image} onChange={(image) => up("advent", { doors: g.advent.doors.map((x, j) => (j === i ? { ...x, image } : x)) })} />
                  <Area label="Text" value={d.text} onChange={(text) => up("advent", { doors: g.advent.doors.map((x, j) => (j === i ? { ...x, text } : x)) })} className="md:col-span-2" />
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}

      {tab === "Tools" && (
        <div className="space-y-5">
          <Card title="SuperScan (3D AI skin scan)" sub="Page /skin-scan/: a guided 3D face scan (front and both sides, camera only, no uploads) is read by an AI vision model and a routine is built from stock. Photos are not stored.">
            <Toggle label="Skin scan page is on" checked={g.skinScan.enabled} onChange={(enabled) => up("skinScan", { enabled })} />
            <div className="mt-3"><Area label="Intro" value={g.skinScan.intro} onChange={(intro) => up("skinScan", { intro })} /></div>
            <p className={`mt-3 text-sm ${aiReady ? "text-green-700" : "text-sale"}`}>{aiReady ? "✓ AI key found — the scan works." : "Not connected: paste a Claude API key in Admin → Sections & AI. Until then the page offers the quiz."}</p>
          </Card>
          <Card title="Subscribe & save" sub="Customers choose monthly or every-3-months delivery on the product page and get an extra discount. Orders are placed automatically (cash on delivery) and they can skip, change or cancel from their link. Manage them in Admin → Subscriptions.">
            <Toggle label="Offer subscriptions" checked={g.subscribe.enabled} onChange={(enabled) => up("subscribe", { enabled })} />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Num label="Monthly: extra % off" value={g.subscribe.monthly} onChange={(monthly) => up("subscribe", { monthly })} />
              <Num label="Every 3 months: extra % off" value={g.subscribe.quarterly} onChange={(quarterly) => up("subscribe", { quarterly })} />
              <Num label="Monthly: unlocks after N delivered orders" value={g.subscribe.unlockMonthly} onChange={(unlockMonthly) => up("subscribe", { unlockMonthly })} />
              <Num label="Every 3 months: unlocks after N delivered orders" value={g.subscribe.unlockQuarterly} onChange={(unlockQuarterly) => up("subscribe", { unlockQuarterly })} />
              <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" checked={!!g.subscribe.promo?.enabled} onChange={(e) => up("subscribe", { promo: { endsAt: g.subscribe.promo?.endsAt ?? "", enabled: e.target.checked } })} /> Campaign: plans started now get the discount from the 2nd order (no rebate on the first)</label>
              <Text label="Campaign ends on (YYYY-MM-DD, empty = no end)" value={g.subscribe.promo?.endsAt ?? ""} onChange={(endsAt) => up("subscribe", { promo: { enabled: !!g.subscribe.promo?.enabled, endsAt } })} placeholder="2026-12-31" />
              <Num label="Max rebate used per order ($)" value={g.subscribe.maxRebate} onChange={(maxRebate) => up("subscribe", { maxRebate })} />
              <Num label="No rebate if re-subscribing within (days)" value={g.subscribe.cooldownDays} onChange={(cooldownDays) => up("subscribe", { cooldownDays })} />
              <Text label="Only for this collection (empty = every product)" value={g.subscribe.collection} onChange={(collection) => up("subscribe", { collection })} placeholder="collection slug" />
              <Text label="Note under the options" value={g.subscribe.note} onChange={(note) => up("subscribe", { note })} />
            </div>
          </Card>
          <Card title="Foundation shade finder" sub="Page /shade-finder/: 5 questions → shade range, undertone letters and matching foundations in stock.">
            <Toggle label="Shade finder page is on" checked={g.shadeFinder.enabled} onChange={(enabled) => up("shadeFinder", { enabled })} />
          </Card>
        </div>
      )}

      {tab === "SuperPrime" && (
        <div className="space-y-5">
          <Card title="SuperPrime membership" sub="Free delivery on every order, and SuperPrice with no daily limit. Paid with an order (cash on delivery works): each payment covers 30 days and is renewed at checkout, never charged by itself. One free trial per phone number.">
            <Toggle label="SuperPrime on" checked={g.prime.enabled} onChange={(enabled) => up("prime", { enabled })} />
            <div className="grid gap-4 md:grid-cols-3">
              <Text label="Name" value={g.prime.name} onChange={(name) => up("prime", { name })} />
              <Num label="Price per month ($)" step={0.01} value={g.prime.monthlyPrice} onChange={(monthlyPrice) => up("prime", { monthlyPrice })} />
              <Num label="Free trial (months)" hint="0 = no trial" value={g.prime.trialMonths} onChange={(trialMonths) => up("prime", { trialMonths })} />
              <Num label="Trial needs a first order of at least ($)" value={g.prime.trialMinOrder} onChange={(trialMinOrder) => up("prime", { trialMinOrder })} />
              <Num label="Free delivery for members from ($)" hint="Stops $2 orders costing a $4 delivery. 0 = every order." value={g.prime.freeMin} onChange={(freeMin) => up("prime", { freeMin })} />
            </div>
            <Toggle label="Members get SuperPrice with no daily limit" checked={g.prime.unlimitedSuperPrice} onChange={(unlimitedSuperPrice) => up("prime", { unlimitedSuperPrice })} />
          </Card>
          <Card title="Free-trial campaign" sub="Switch on to give the free trial to everyone, with no minimum order (for example during Black Friday). Still one trial per phone number.">
            <Toggle label="Campaign on: free trial with any order" checked={g.prime.promo.enabled} onChange={(enabled) => up("prime", { promo: { ...g.prime.promo, enabled } })} />
            <Text label="Ends on (optional)" type="date" value={g.prime.promo.endsAt.slice(0, 10)} onChange={(d) => up("prime", { promo: { ...g.prime.promo, endsAt: d ? `${d}T23:59:59+02:00` : "" } })} />
          </Card>
        </div>
      )}

      {tab === "Price match" && (
        <div className="space-y-5">
          <Card title="SuperPrice Guaranteed" sub="Every night at 3 am we read the shops below and find our products there (same item, or brand + name + size). When a shop sells an item for less, the website and app sell it below their price, never under cost + your margin. When they go back up, our own price comes back by itself.">
            <Toggle label="SuperPrice on" checked={g.priceMatch.enabled} onChange={(enabled) => up("priceMatch", { enabled })} />
            <Toggle label="Show SuperPrice to shoppers" hint="Badge and comparison on the product page, the reveal in the bag and the guarantee at checkout. Off: prices still drop, quietly." checked={g.priceMatch.badge} onChange={(badge) => up("priceMatch", { badge })} />
            <div className="grid gap-4 md:grid-cols-3">
              <Num label="Shop is cheaper: go below them by (%)" hint="0 = match their price" value={g.priceMatch.beatPct} onChange={(beatPct) => up("priceMatch", { beatPct })} />
              <Num label="Shop has the same price: go below them by (%)" hint="0 = leave it" value={g.priceMatch.tieBeatPct} onChange={(tieBeatPct) => up("priceMatch", { tieBeatPct })} />
              <Num label="Never under cost + (%)" hint="Imported items use the landed cost (freight, duty and VAT)." value={g.priceMatch.marginPct} onChange={(marginPct) => up("priceMatch", { marginPct })} />
              <Num label="Never more than (%) off our price" value={g.priceMatch.maxOffPct} onChange={(maxOffPct) => up("priceMatch", { maxOffPct })} />
              <Num label="No cost on file: assume a margin of (%)" hint="Trial setting until supplier costs are added. 0 = never SuperPrice items without a cost." value={g.priceMatch.assumeMarginPct} onChange={(assumeMarginPct) => up("priceMatch", { assumeMarginPct })} />
              <Num label="SuperPrice units per item per order" value={g.priceMatch.maxUnits} onChange={(maxUnits) => up("priceMatch", { maxUnits })} />
            </div>
            <Toggle label="Don't compare a product with the shop we buy it from" hint="Products imported from NeoVitale, Skin Society or HOLDAL are not cut below that same shop's price (we'd be selling under our own buying price)." checked={g.priceMatch.skipOwnSource} onChange={(skipOwnSource) => up("priceMatch", { skipOwnSource })} />
            <Toggle label="One SuperPrice order per customer a day" hint="By phone number. A second order the same day pays the regular price (the customer is told first). Coupons, wheel prizes and member prices never apply on top of a SuperPrice." checked={g.priceMatch.oncePerDay} onChange={(oncePerDay) => up("priceMatch", { oncePerDay })} />
          </Card>
          <Card title="Shops we compare with" sub="Shopify shops with a public product feed, priced in US dollars. Turn off “Show name” to say “cheaper than other shops” without naming the shop.">
            <div className="space-y-3">
              {g.priceMatch.sites.map((s, i) => {
                const set = (patch: Partial<typeof s>) => up("priceMatch", { sites: g.priceMatch.sites.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto]">
                    <Text label={i ? "" : "Web address"} value={s.domain} placeholder="shop.com" onChange={(domain) => set({ domain: domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "") })} />
                    <Text label={i ? "" : "Name shown"} value={s.label} onChange={(label) => set({ label })} />
                    <Toggle label="On" checked={s.enabled} onChange={(enabled) => set({ enabled })} />
                    <Toggle label="Show name" checked={s.showName} onChange={(showName) => set({ showName })} />
                    <button type="button" onClick={() => up("priceMatch", { sites: g.priceMatch.sites.filter((_, j) => j !== i) })} className="pb-2 text-sale" aria-label="Remove">✕</button>
                  </div>
                );
              })}
              <button type="button" onClick={() => up("priceMatch", { sites: [...g.priceMatch.sites, { domain: "", label: "", enabled: true, showName: true }] })} className="text-sm font-semibold text-brand-600">+ Add shop</button>
            </div>
          </Card>
          <Card title="Last check" sub="Save your changes first, then check now, or wait for tonight's check.">
            <PriceMatchReport />
          </Card>
        </div>
      )}

      {tab === "Gamification" && (
        <div className="space-y-5">
          <Card title="Gamification" sub="Goals, badges, streaks and quests that reward shoppers with Club points. Points only: no prizes of chance. The spin-to-win wheel is in the Sign-up pop-up tab (every spin wins).">
            <Toggle label="Gamification on" checked={g.game.enabled} onChange={(enabled) => up("game", { enabled })} />
            <Toggle label="Celebrations (confetti and phone vibration on reached goals)" hint="Always off for visitors who turn on reduce motion." checked={g.game.celebrate} onChange={(celebrate) => up("game", { celebrate })} />
          </Card>
          <Card title="Reward ladder in the bag" sub="One bar with milestones: free delivery, gift and sample tiers (from Promotions and Samples), and double Club points.">
            <Toggle label="Double points step on" checked={g.game.ladder.enabled} onChange={(enabled) => up("game", { ladder: { ...g.game.ladder, enabled } })} />
            <Num label="Orders of at least ($) earn double Club points (0 = off)" value={g.game.ladder.doublePointsAt} onChange={(doublePointsAt) => up("game", { ladder: { ...g.game.ladder, doublePointsAt } })} />
          </Card>
          <Card title="Badges" sub="Earned once each and shown in the customer's account. Points are paid the first time the account is opened after earning it.">
            <Toggle label="Badges on" checked={g.game.badges.enabled} onChange={(enabled) => up("game", { badges: { ...g.game.badges, enabled } })} />
            <div className="grid gap-4 md:grid-cols-4">
              {BADGES.map((b) => <Num key={b.id} label={`${b.name} (points)`} hint={b.text} value={g.game.badges.points[b.id] ?? 0} onChange={(v) => up("game", { badges: { ...g.game.badges, points: { ...g.game.badges.points, [b.id]: v } } })} />)}
            </div>
          </Card>
          <Card title="Review quest" sub="Review N products you bought (verified reviews from the WhatsApp link).">
            <Toggle label="Quest on" checked={g.game.quest.enabled} onChange={(enabled) => up("game", { quest: { ...g.game.quest, enabled } })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Num label="Reviews needed" value={g.game.quest.reviews} onChange={(reviews) => up("game", { quest: { ...g.game.quest, reviews } })} />
              <Num label="Points when complete" value={g.game.quest.points} onChange={(points) => up("game", { quest: { ...g.game.quest, points } })} />
            </div>
          </Card>
          <Card title="Refill streak" sub="Subscribe & save customers earn bonus points on every Nth delivered refill.">
            <Toggle label="Refill streak on" checked={g.game.streak.enabled} onChange={(enabled) => up("game", { streak: { ...g.game.streak, enabled } })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Num label="Every N delivered refills" value={g.game.streak.every} onChange={(every) => up("game", { streak: { ...g.game.streak, every } })} />
              <Num label="Bonus points" value={g.game.streak.points} onChange={(points) => up("game", { streak: { ...g.game.streak, points } })} />
            </div>
          </Card>
          <Card title="Daily tip check-in (app)" sub="A pharmacist tip a day on the app home. Opening it N days in a row earns points (Club members).">
            <Toggle label="Check-in on" checked={g.game.checkin.enabled} onChange={(enabled) => up("game", { checkin: { ...g.game.checkin, enabled } })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Num label="Days in a row" value={g.game.checkin.days} onChange={(days) => up("game", { checkin: { ...g.game.checkin, days } })} />
              <Num label="Points for a full streak" value={g.game.checkin.points} onChange={(points) => up("game", { checkin: { ...g.game.checkin, points } })} />
            </div>
            <Area label="Tips (one per line, shown in order, one a day)" hint={`${g.game.checkin.tips.filter((x) => x.trim()).length} tips · leave empty to use the built-in list`} rows={10} value={g.game.checkin.tips.join("\n")} onChange={(v) => up("game", { checkin: { ...g.game.checkin, tips: v.split("\n") } })} />
          </Card>
          <Card title="Referral race" sub="Bonus points when a member's link brings 3, 5, 10… friends (on top of the points per friend).">
            <Toggle label="Referral race on" checked={g.game.race.enabled} onChange={(enabled) => up("game", { race: { ...g.game.race, enabled } })} />
            <div className="grid gap-4 md:grid-cols-3">
              {g.game.race.steps.map((st, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Num label="Friends" value={st.friends} onChange={(friends) => up("game", { race: { ...g.game.race, steps: g.game.race.steps.map((x, j) => (j === i ? { ...x, friends } : x)) } })} />
                  <Num label="Points" value={st.points} onChange={(points) => up("game", { race: { ...g.game.race, steps: g.game.race.steps.map((x, j) => (j === i ? { ...x, points } : x)) } })} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Look, motion & duplicates" && (
        <div className="space-y-5">
          <Card title="Animations" sub="Sections rising in on scroll, cards lifting, the bag bouncing, the glowing Routine finder link. Always off for visitors who turn on “reduce motion”.">
            <Toggle label="Animations on" checked={g.motion !== false} onChange={(motion) => (saver.touch(), setG({ ...g, motion }))} />
          </Card>
          <Card title="Uniform product photos" sub="Every photo sits in the same frame. White photo backgrounds blend into it, so mixed photos look like one set.">
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Frame colour" value={g.images.frame} onChange={(frame) => up("images", { frame })} options={[["grey", "Light grey (Sephora style)"], ["white", "White"]]} />
              <Num label="Margin around the product (%)" value={g.images.padding} onChange={(padding) => up("images", { padding })} />
            </div>
          </Card>
          <Card title="Same product in both catalogs" sub="When Neovitale and Skin Society sell the same item (same brand, name and size), show it once.">
            <div className="grid gap-4 md:grid-cols-2">
              <Toggle label="Show each product once" checked={g.dedupe.enabled} onChange={(enabled) => up("dedupe", { enabled })} />
              <Select label="Which listing to keep" value={g.dedupe.prefer} onChange={(prefer) => up("dedupe", { prefer })} options={[["cheapest", "The cheapest in stock"], ["neovitale.com", "Neovitale's"], ["skinsociety.me", "Skin Society's"]]} />
            </div>
            <p className="mt-2 text-xs text-muted">The hidden listing's page redirects to the one kept. Nothing is deleted — switch this off to show both again.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
