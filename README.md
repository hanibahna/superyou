# SuperYou: storefront + admin CMS (Next.js on Vercel)

A parapharmacy / beauty / supplements shop for Lebanon. It has a storefront, checkout (cash on delivery, cards, Whish), and an admin area at **/admin** for products, categories, CSV/Excel import and orders.

Brand: **SuperYou**. Logo files are in `public/brand/` (colour, white-on-dark, and square icon) — an "sy" monogram icon (italic serif, plum tile, gold sparkle) beside the superyou wordmark; default colours are rose #c0587a and plum #2e2229 — change them any time in **Admin → Appearance**. The sample products are placeholders.

---

## 1. Deploy (about 10 minutes)

1. **Deploy:** drag the zip onto **vercel.com/drop**, or import the folder from GitHub.
2. **Database:** in the Vercel project, go to **Storage → Create Database → Upstash (Redis)** and connect it to the project. This is free and adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` for you.
3. **Photo uploads (optional):** go to **Storage → Create → Blob** and connect it. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Admin password:** under **Settings → Environment Variables**, add `ADMIN_PASSWORD` (long and private).
5. **Redeploy:** go to **Deployments → ⋯ → Redeploy** so the new settings take effect.
6. **Sign in:** open `your-site.vercel.app/admin`, sign in, and either import your catalog or click *Load sample products*.

> Without the database, the admin shows a yellow warning and nothing you change is kept.

---

## 2. Importing a partner store's full catalog (e.g. Neovitale)

Go to **Admin → Import / export → Import from another online store**. Only do this for a store that has given you permission.

1. **Fill in the form:**
   - Type the store address, e.g. `neovitale.com`. It must be a Shopify store; most Lebanese beauty shops are.
   - Optionally set a **price adjustment**. For example, `-5` sells 5% below their price.
   - Optionally tick **import as drafts**, which keeps the products hidden until you're ready.
2. **Click Start import.** The app reads the store's whole catalog page by page (about 9,200 products / 11,300 sizes for Neovitale). It takes a few minutes, and progress and a category breakdown show as it runs.
3. **What gets copied:** name, brand, every size/shade with its own price, sale price and availability, photos, and description.
   - Sizes/shades of one item become **one product card with a size picker**.
   - Products are sorted into SuperYou's 12 categories (Skincare, Suncare, Makeup, Hair, Body & Bath, Fragrance, Nails, Men, Baby & Mom, Supplements, Health & Medical, Oral Care).
   - They're also tagged with concerns (acne, dryness, anti-aging, hair loss, immunity…) and homepage badges (deals, new, best sellers, bundles).
4. **Run it again any time** to refresh prices and stock. Products are matched by SKU (`NEO-<their variant number>`), so nothing is duplicated. With "Remove products the store no longer sells" ticked, discontinued items are deleted.
5. **Photos:** at first they load from the source store's image server. Click **Copy photos** to store copies in your own Vercel Blob storage, so they keep working if the source removes a product.
   - "Main photo only" is about 0.7 GB for 9,000 products, so check your Blob plan's storage limit first.

## Running the shop (admin → /admin)

| Admin page | What you can do |
|---|---|
| **Homepage** | Add, reorder, hide and duplicate sections: hero slider (photo or looping video), countdown, product rows (by badge, category, brand, concern, search, hand-picked SKUs, on sale, newest), category tiles, shop by concern, brand strip, promo banners (image or video), video, text block, newsletter, social videos (library or live TikTok profile feed). |
| **Themes & colours** | 7 layout themes (Classic, Minimal, Luxe, Clinical, Playful, Editorial, Bold) with fine-tuning (fonts, corners, buttons, cards, header, photo shape, spacing, products per row), plus the colour palette. |
| **Discounts & free gifts** | Automatic sales or coupon codes by brand / category / concern / badge / SKU with exclusions, dates, minimum spend and usage limits. Free gifts by spend level: the customer picks a gift in the cart, and the server checks it. |
| **Search & filters** | Synonyms, pinned results (product boosts), hidden items, search redirects, stop words, searched fields, typo tolerance, sold-out handling, suggestions while typing, popular searches, which filters show, products per page, default sort. |
| **Video library** | Paste TikTok / Instagram / YouTube / Facebook / Vimeo links, or upload MP4s. Titles, thumbnails and tags are filled in automatically; videos appear on matching category, brand and product pages. YouTube channels sync automatically. |
| **Routine finder** | The /routine skincare quiz: steps, keywords, tips, skin types, concerns, goals, pinned products. |
| **Settings** | Store details, social links, announcement bar, delivery fee + per-area fees, free-delivery threshold, payment methods on/off and wording, minimum order, SEO, trust badges, info pages. |
| **Subscribers** | Newsletter sign-ups and a CSV download. |
| **Help & guides** | How-tos inside the admin. |

Products also have a **How-to video** field (link or upload), and the CSV import/export has a `video` column.

Uploads (photos and videos up to 500 MB) need **Vercel Blob**: Storage → Create → Blob → connect, then redeploy. Without it, paste links instead.

**Services & events.** Bookable in-store services with time slots (opening hours, parallel appointments, lead time) and events with RSVP and capacity at `/services`. Bookings land in Admin → Bookings & sign-ups with one-tap WhatsApp confirmations.

**Black Friday 2026 homepage.** Campaign hero with countdown and product collage, promo cards, round category pictures and an offers grid, all built from catalog photos and editable in Admin → Homepage.

**Skin Society catalog, menus and pages.** The built-in setup also includes Skin Society's catalog (25,181 items incl. shades and sizes), its full 3-level menu (Admin → Navigation), 691 collections at the same `/collections/…` addresses (Admin → Collections) and 250+ info and brand pages (Admin → Settings → Pages). The shop uses the **Noir** layout (Sephora-style black & white with rose accents). **Admin → Products → Restore built-in design & menus** reapplies this setup at any time.

Large catalogs: the product index is read in chunks (Upstash allows 10 MB per request). With ~36,000 items each server start reads ~20 MB, so Upstash's **Pay-as-you-go** plan (200 GB bandwidth) is recommended over the free plan (10 GB/month).

**Built-in catalog.** The app ships with the full Neovitale catalog (11,323 items, 1,268 of them using Feel22's white-background photos) and the Skin Society catalog (`data/seed-catalog.json.gz`, `data/seed-site.json`). On first start, an empty database is filled from it automatically, once. Later edits, imports and deletions are never undone. **Admin → Products → Restore built-in catalog** loads it again, and **Download backup (JSON)** saves your whole catalog in the same format.

**Use another store's photos (e.g. Feel22).** Feel22's photos are 100% white-background squares. Under **Admin → Import / export → Use photos from another store**:

1. Type `feel22.com` and click **Find matches**. Products are matched by brand, name and size.
2. Strict rules prevent mismatches: a shampoo never matches a conditioner, retinol never matches retinal, and shade 312 never matches shade 313.
3. Review the side-by-side list (current photo vs new photo), untick anything wrong, then click **Use their photos**.

Items sold in several shades keep their own shade photos. Replaced photos are locked, so re-importing Neovitale prices and stock later won't overwrite them. Only use stores that have given you permission.

Built for scale: the shop keeps a compact index of all products in memory and pages, filters and searches on the server. With 11,000+ products, listing pages still render in well under 0.2 s. The Upstash free tier (256 MB) easily holds the catalog, at about 20 MB.

## 3. Importing your catalog from CSV or Excel

Go to **Admin → Import / export**.

1. **Get a file.** Click *Download template* for a ready-made CSV, or use any supplier price list (.xlsx or .csv). Old `.xls` files must first be re-saved in Excel as `.xlsx` or `.csv`.
2. **Drop the file in.** The importer finds the header row automatically, even with titles or blank lines above it. If a workbook has several sheets, you choose which one.
3. **Match the columns.** Common names are recognised automatically, for example "Item Code" → SKU, "Retail Price" → Price, "RRP" → Compare-at, "Vendor" → Brand, "Qty" → Stock. Fix any guess from the dropdowns.
4. **Check the preview.** It shows how many products are **new**, how many will **update** (same SKU), and which rows have problems. Rows with problems are skipped; the rest still import.
5. **Click Import.** Large files are sent in batches. Afterwards you can download a CSV listing the skipped rows.

### Columns

| Column | Required | Notes |
|---|---|---|
| `sku` | ✓ | Your unique product code. **Re-importing the same SKU updates that product** instead of creating a duplicate. |
| `name` | ✓ | |
| `price` | ✓ | In USD. `$`, `USD` and thousands commas (`$1,250.00`) are cleaned up. |
| `compare_at_price` | | Original price. When it's higher than `price`, the shop shows a −% badge. |
| `brand` | | |
| `category` | | Category name or slug. **Unknown categories are created automatically.** |
| `concerns` | | Several, separated by `\|` or `,` (e.g. `Acne \| Dryness`). Unknown ones are created. |
| `size` | | e.g. `50 ml` |
| `stock` | | Quantity. `0` = sold out. Leave empty if you don't track stock. |
| `status` | | `active` (default) or `draft` (hidden). |
| `tags` | | Homepage sections: `deal`, `mega`, `favorite`, `new`, `bundle`, `half`. |
| `images` | | Full image URLs; separate several with `\|`. The first one is the main photo. |
| `description`, `how_to_use`, `ingredients`, `barcode` | | |
| `group`, `variant` | | Rows with the same `group` are sizes/shades of one item (one card + size picker); `variant` is the label, e.g. `50 ml`. |

### Options

- **Updating:** in an update, a blank cell or a skipped column keeps the product's current value. So you can update prices only with a two-column file (`sku, price`) plus `name`.
- **Import as drafts:** new products stay hidden until you publish them.
- **Full sync:** deletes products whose SKU isn't in the file. Use it when the file is your complete catalog.
- **Export:** *Export all products (CSV)* downloads the whole catalog in the same format. You can edit it in Excel and import it back.

An example file is in `docs/sample-import.csv`.

---

## 4. What's in the admin

| Page | What you can do |
|---|---|
| **Dashboard** | Sales for the last 30 days, open orders, live/draft counts, sold-out and low-stock alerts, quick actions |
| **Orders** | All orders, newest first. The detail page has customer and WhatsApp links, items, payment info and a status changer (new → confirmed → packed → shipped → delivered, cancelled/returned). |
| **Products** | Search (name, brand, SKU, barcode), filter by category or status. Bulk publish, unpublish or delete. |
| **Product editor** | Name, brand, size, photos (upload or URL, set the main photo), description, how to use, ingredients, price and compare-at price (with a live % preview), SKU, barcode, stock, category, concerns, homepage badges, draft/live, duplicate, delete |
| **Import / export** | Covered in section 2 |
| **Appearance** | Pick the brand, text, sale and background colours (or one of 6 ready-made palettes: Rose, Blush Nude, Lavender, Botanic Green, Clinical Blue, Noir & Gold). All shades are generated automatically; a live preview and a readability (contrast) check show the result before you publish. Download the palette as a swatch sheet (SVG), CSS or JSON for designers and print. |
| **Categories & concerns** | Rename, reorder (this sets the shop menu order), add, remove; shows how many products use each |

Security: the admin uses a single password with a signed cookie that lasts 7 days, and login is rate-limited. The admin pages are hidden from search engines.

---

## 5. Payments

| Method | Status |
|---|---|
| Cash on delivery | Works out of the box |
| Card via **Tap Payments** | Set `CARD_PROVIDER=tap` and `TAP_SECRET_KEY` |
| Card via **areeba** (Mastercard Gateway) | `CARD_PROVIDER=areeba` plus your merchant credentials. Confirm the gateway host and API version with areeba. |
| Card via **Stripe** | `CARD_PROVIDER=stripe`. Only works with a non-Lebanese registered entity. |
| **Whish Money** | Manual for now: the order is created as "awaiting payment" and staff send a Whish request |

How payments are protected:
- The server recalculates every price from the catalog. Hidden (draft) products can't be bought.
- An order is only marked paid after the shop re-checks the payment with the gateway.
- Card details are only ever entered on the gateway's own page.

---

## 6. Where things live in the code

| What | File |
|---|---|
| Shop name, phone, WhatsApp, delivery fee, free-delivery threshold, delivery zones | `lib/config.ts` |
| Colours | `app/globals.css` (`@theme`) |
| Database client (Upstash REST, with an in-memory fallback) | `lib/db.ts` |
| Catalog read/write | `lib/catalog.ts`, `lib/catalog-admin.ts` |
| Import/validation rules and column aliases | `lib/product-input.ts` |
| Partner-store import + category/concern rules | `lib/import/shopify-source.ts` |
| Photo matching from another store | `lib/import/photo-match.ts` |
| Shop listing, filters, search (server side) | `lib/listing.ts`, `lib/search.ts` |
| Orders | `lib/orders.ts` |
| Payment gateways | `lib/payments/*` |
| Storefront pages | `app/(shop)/…` |
| Admin pages and APIs | `app/admin/…`, `app/api/admin/…`, `components/admin/…` |

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000 — admin password is "admin" in development
```

## Roadmap (next phases)

Discount codes · stock decrement on orders and back-in-stock alerts · delivery zones and courier integration (Wakilni / Aramex) · customer accounts and loyalty · email/WhatsApp notifications · reviews · Arabic/RTL · sales reports
