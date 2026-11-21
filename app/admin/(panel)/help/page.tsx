import Link from "next/link";

const guides: { title: string; steps: React.ReactNode[] }[] = [
  {
    title: "WhatsApp messages & campaigns",
    steps: [
      <>Open <Link href="/admin/whatsapp/">WhatsApp</Link> → Setup and follow the steps for 360dialog, Meta or WATI. Until then everything runs in test mode and appears in the Message log.</>,
      <>Templates tab: submit the ready-made SuperYou templates for approval. Automatic messages tab: choose a template for each event (order received, shipped, delivered, booking confirmed, reminder…).</>,
      <>Contacts are added from checkout, bookings and newsletter sign-ups. Lists group them (VIPs, skin care buyers, win-back…). Campaigns send a marketing template to a list in batches with delivery and read stats. STOP replies unsubscribe automatically.</>,
    ],
  },
  {
    title: "Show or hide catalogs, brands and products",
    steps: [
      <>Open <Link href="/admin/visibility/">Catalog visibility</Link>. Switch the Neovitale or Skin Society catalog off entirely, untick brands, or search a product and switch it off.</>,
      <>Hidden items disappear from the shop, search, menus and carts, but stay in the admin so you can switch them back on anytime.</>,
    ],
  },
  {
    title: "Services & events (bookings)",
    steps: [
      <>Open <Link href="/admin/services/">Services & events</Link> to set opening hours, how many appointments can run at once, and the services and events customers can book at <a href="/services/" target="_blank">/services</a>.</>,
      <>New bookings and event sign-ups appear in <Link href="/admin/bookings/">Bookings & sign-ups</Link> as “pending”. Tap <b>WhatsApp</b> to send the customer a ready-made confirmation, then set the status to confirmed.</>,
      <>Full time slots and full events are closed automatically.</>,
    ],
  },
  {
    title: "Black Friday homepage",
    steps: [
      <>The homepage starts with a <b>Campaign hero</b> (headline, countdown, product collage), <b>Promo cards</b>, <b>Round category pictures</b> and an <b>Offers grid</b>. Edit them in <Link href="/admin/homepage/">Homepage</Link>.</>,
      <>In any card, type a product name in “Use a product photo from the catalog” to drop in its photo and link.</>,
      <>After Black Friday, switch the campaign hero off (or change its text and dates) and update the promo cards for the next season.</>,
    ],
  },
  {
    title: "Show TikTok videos on the site",
    steps: [
      <>TikTok only allows <b>public</b> videos to be shown on other websites. In the TikTok app: Profile → ☰ → Settings and privacy → Privacy → turn off <b>Private account</b>.</>,
      <>Then copy each video's link (Share → Copy link) and paste them into <Link href="/admin/videos/">Video library</Link>. They play directly on the homepage (“Watch our pharmacist tips”) and on matching category, brand and product pages.</>,
    ],
  },
  {
    title: "Edit the main menu (mega menu)",
    steps: [
      <>Open <Link href="/admin/navigation/">Navigation</Link>. Top items are the menu bar; open one (▸) to edit its columns (level 2) and their links (level 3).</>,
      <>Each link can point to a collection (<code>/collections/skin-care-cleansers/</code>), a brand (<code>/shop/?brand=Vichy</code>), a category, <code>/brands/</code>, an info page or any address. Use <code>#</code> for a heading that isn't a link.</>,
      <>Tick “red” to show a link in the sale colour (e.g. Value Deals). Add an optional picture to a drop-down. Save, then Preview.</>,
    ],
  },
  {
    title: "Collections",
    steps: [
      <>Open <Link href="/admin/collections/">Collections</Link>. Imported products already belong to their Skin Society collections.</>,
      <>Add more products to a collection by brand or by search words (e.g. “vitamin c serum”), give it an intro text and a banner, or create new collections for campaigns.</>,
      <>Use collections in the menu, in homepage product rows (“From a collection”) and in banners.</>,
    ],
  },
  {
    title: "Add a “how to use” video to a product",
    steps: [
      <>Open <Link href="/admin/products/">Products</Link> and click the product.</>,
      <>In <b>How-to video</b>, paste a TikTok, Instagram Reel, YouTube or Vimeo link, or click <b>Upload</b> for an MP4 from your phone (needs Vercel Blob).</>,
      <>Save. The video appears at the top of the product's <b>How to use</b> section, opened by default. Vertical videos (TikTok/Reels) show in a tall frame.</>,
      <>Tips: keep it 15–60 seconds, show the texture and the amount to use, and film in daylight. One video can serve all sizes of the same product.</>,
    ],
  },
  {
    title: "Show social videos on the right category, brand and product pages",
    steps: [
      <>Open <Link href="/admin/videos/">Video library</Link> and paste video links (one per line — you can paste 20 at once from @pharmatipss).</>,
      <>Titles, thumbnails and tags (category, brand, concern) are filled in automatically. Click a video to check or change its tags, and link the exact products it features.</>,
      <>Save. Videos now show on matching category pages, brand pages and product pages. Choose where in <b>Where videos appear</b>.</>,
      <>For YouTube, add your channel id under <b>YouTube channels</b> and press <b>Sync now</b> — new uploads are imported and tagged automatically.</>,
      <>On the <Link href="/admin/homepage/">Homepage</Link>, add a <b>Social videos</b> section to show your live TikTok profile feed or chosen library videos.</>,
    ],
  },
  {
    title: "Run a sale on a brand or category",
    steps: [
      <>Open <Link href="/admin/promotions/">Discounts & free gifts</Link> → <b>New discount</b>.</>,
      <>Name it (customers see it), choose % or $ off, then <b>Applies to</b> → Brands / Categories / Concerns / Badges / Specific products. Use <b>Except</b> to leave a brand out.</>,
      <>Leave <b>Coupon code</b> empty so the sale price shows everywhere automatically. Set start and end dates, switch it on and Save.</>,
    ],
  },
  {
    title: "Create a coupon code",
    steps: [
      <>New discount → type a code such as <b>WELCOME10</b>. Optionally set a minimum spend and a maximum number of uses.</>,
      <>Customers enter it in the cart or at checkout. By default codes don't apply to items already on sale; tick “Also applies to items already on sale” to allow it.</>,
    ],
  },
  {
    title: "Give free gifts by spend",
    steps: [
      <>Discounts & free gifts → <b>New gift level</b>. Set the spend (e.g. $50) and how many gifts the customer may choose.</>,
      <>Add the gift options with the product search. Optionally count only spend on a brand or category (“Spend $40 on Vichy”).</>,
      <>Add several levels ($50 → 1 gift, $100 → 2 gifts). The cart shows “Spend $X more…” and lets customers pick; gifts are added to the order at $0 and checked on the server.</>,
    ],
  },
  {
    title: "Change the homepage",
    steps: [
      <>Open <Link href="/admin/homepage/">Homepage</Link>. Use ↑ ↓ to reorder, the switch to hide, ⧉ to duplicate and Edit to change a section.</>,
      <><b>Add section</b> offers: hero slider (photo or video), countdown, product rows (by badge, category, brand, concern, search, hand-picked SKUs, on sale, newest), category tiles, concerns, brands, promo banners, video, text, newsletter and social videos.</>,
      <>Save, then click Preview.</>,
    ],
  },
  {
    title: "Change the look",
    steps: [
      <>Open <Link href="/admin/appearance/">Themes & colours</Link>. Pick one of 7 layouts (Classic, Minimal, Luxe, Clinical, Playful, Editorial, Bold), fine-tune fonts, corners, buttons, cards, header and photo shape, and Save.</>,
      <>Then pick or adjust the colours below and Save again.</>,
    ],
  },
  {
    title: "Improve search",
    steps: [
      <>Open <Link href="/admin/search/">Search & filters</Link>. Add synonyms customers use (“sunblock, sunscreen, spf”).</>,
      <>Pin best products for key searches, redirect searches like “offers” to a page, hide items from search, and choose which filters show on listing pages.</>,
      <>Use the “Test a search” box to check the result.</>,
    ],
  },
  {
    title: "Skincare routine finder",
    steps: [
      <>It's live at <a href="/routine/" target="_blank">/routine</a> and in the menu. Customers answer skin type, concerns, goals, sensitivity and budget, then add the whole routine to the cart.</>,
      <>In <Link href="/admin/routine/">Routine finder</Link> adjust steps, keywords and tips, and pin products you want recommended first for each step.</>,
    ],
  },
  {
    title: "Uploading photos and videos",
    steps: [
      <>Uploads need a Vercel Blob store: Vercel → your project → Storage → Create → Blob → Connect, then redeploy. Videos up to 500 MB go straight from your browser to Blob storage.</>,
      <>Without Blob you can always paste links instead.</>,
    ],
  },
];

export default function HelpPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Help & guides</h1>
      <p className="mb-6 text-sm text-muted">Short how-tos for the most common jobs.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {guides.map((g) => (
          <section key={g.title} className="rounded-xl bg-white p-5 shadow-sm [&_a]:text-brand-600 [&_a]:underline">
            <h2 className="mb-3 font-semibold">{g.title}</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </section>
        ))}
      </div>
    </div>
  );
}
