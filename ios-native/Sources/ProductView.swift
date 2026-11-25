import SwiftUI

struct ProductView: View {
    let slug: String
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
    @EnvironmentObject var wishlist: Wishlist
    @State private var videos: [Video] = []
    @State private var playing: Video?
    @State private var howTo = false
    @State private var every: Int? = nil
    @State private var subscribe: Config.Subscribe?
    @State private var spCfg: Config.SuperPriceCfg?
    @State private var bulkCfg: Config.BulkCfg?
    @State private var qty = 1
    @State private var product: Product?
    @State private var selected: Variant?
    @State private var added = false
    @State private var failed = false

    var body: some View {
        ScrollView {
            if let p = product, let v = selected ?? p.variants.first {
                VStack(alignment: .leading, spacing: 16) {
                    TabView {
                        ForEach(p.images, id: \.self) { RemoteImage(url: $0).padding() }
                    }.tabViewStyle(.page).frame(height: 340).background(Color.white)
                    if !videos.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(videos.prefix(4)) { vid in
                                    Button { playing = vid } label: {
                                        ZStack {
                                            RemoteImage(url: "https://i.ytimg.com/vi/\(vid.id)/mqdefault.jpg", fit: .fill).frame(width: 112, height: 64).clipped()
                                            Image(systemName: "play.circle.fill").font(.title2).foregroundStyle(.white).shadow(radius: 3)
                                        }.clipShape(RoundedRectangle(cornerRadius: 10))
                                    }.accessibilityLabel("Play video: \(vid.title)")
                                }
                            }.padding(.horizontal)
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text(p.brand.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        HStack(alignment: .top) {
                            Text(p.name).font(.display(20))
                            Spacer()
                            Button { wishlist.toggle(card(p, v)) } label: {
                                Image(systemName: wishlist.has(p.slug) ? "heart.fill" : "heart").font(.title3).foregroundStyle(Color.rose)
                            }.accessibilityLabel(wishlist.has(p.slug) ? "Remove from wishlist" : "Save to wishlist")
                        }
                        if let r = p.rating, p.reviewCount >= 3 { Label(String(format: "%.1f · %d reviews", r, p.reviewCount), systemImage: "star.fill").font(.footnote).foregroundStyle(Color.rose) }
                        if let sp = v.superPrice, sp.lowered, let was = sp.was, spCfg != nil {
                            SuperPriceTag(was: was, price: v.price).id(v.id)
                        } else {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(money(v.price)).font(.display(22)).foregroundStyle(v.compareAt != nil ? Color.rose : Color.ink)
                                if let c = v.compareAt, c > v.price { Text(money(c)).strikethrough().foregroundStyle(.secondary) }
                            }
                        }
                        ShipBadge(origin: v.origin, shipFrom: v.shipFrom, daysMin: v.daysMin, daysMax: v.daysMax)
                        if v.origin == "international" {
                            Text("Imported for you from \(v.shipFrom). The price already includes international shipping, customs duty and VAT: nothing more to pay at the door.").font(.footnote).foregroundStyle(Color.indigoShip)
                                .padding(10).background(Color(hex: "#eef2ff"), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }.padding(.horizontal)

                    if p.variants.count > 1 {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(p.variants) { x in
                                    Button { selected = x } label: {
                                        Text(x.name).font(.footnote.weight(.semibold)).lineLimit(1).padding(.horizontal, 14).padding(.vertical, 9)
                                            .foregroundStyle(x == v ? .white : Color.ink)
                                            .background(x == v ? Color.ink : Color.white, in: Capsule())
                                            .overlay(Capsule().stroke(Color(hex: "#eee5ea")))
                                            .opacity(x.inStock ? 1 : 0.45)
                                    }
                                }
                            }.padding(.horizontal)
                        }
                    }

                    if p.subscribable == true, let s = subscribe {
                        VStack(alignment: .leading, spacing: 8) {
                            // Delivery as often as this product runs out (AI estimate), plus one step more often.
                            let rec = p.life?.every ?? 3
                            let all = [1, 2, 3, 4, 6]
                            let plans = rec > 1 ? [all[(all.firstIndex(of: rec) ?? 2) - 1], rec] : [1]
                            if let l = p.life { Text("Lasts about \(l.days < 45 ? "\(l.days / 7) weeks" : "\(Int((Double(l.days) / 30.4).rounded())) months") · \(l.basis)").font(.caption).foregroundStyle(.secondary) }
                            Picker("Buy", selection: $every) {
                                Text("Once").tag(Int?.none)
                                ForEach(plans, id: \.self) { e in Text(e == 1 ? "Monthly" : "Every \(e) mo").tag(Int?.some(e)) }
                            }.pickerStyle(.segmented)
                            if every == rec { Text("Recommended for this product · earn \(Int(rec == 1 ? s.monthly : s.quarterly))%").font(.caption.bold()).foregroundStyle(Color.greenShip) }
                            if let e = every { Text("After \(e == 1 ? (s.unlockMonthly ?? 3) : (s.unlockQuarterly ?? 2)) deliveries you get \(Int(e == 1 ? s.monthly : s.quarterly))% back on them, then \(Int(e == 1 ? s.monthly : s.quarterly))% off every order. \(s.note)").font(.caption).foregroundStyle(.secondary) }
                        }.padding(.horizontal)
                    }
                    if let b = bulkCfg, v.inStock, every == nil, v.superPrice?.lowered != true { BulkOffer(cfg: b, price: v.price, qty: $qty).padding(.horizontal) }
                    Button {
                        bag.add(p, v, qty: qty, every: every); added = true
                    } label: {
                        Text(v.inStock ? (added ? "Added ✓  ·  Add another" : "Add to bag") : "Out of stock").font(.headline).frame(maxWidth: .infinity).padding()
                    }
                    .buttonStyle(.borderedProminent).tint(Color.ink).disabled(!v.inStock).padding(.horizontal)
                    if let sp = v.superPrice, let cfg = spCfg, v.inStock { SuperPriceCard(sp: sp, price: v.price, cfg: cfg).id(v.id).padding(.horizontal) }
                    HowToBox(product: p, videos: videos) { playing = $0 }.padding(.horizontal)
                    if added { Button("Go to bag") { router.tab = 3 }.frame(maxWidth: .infinity) }

                    HStack(spacing: 18) {
                        Label("Original", systemImage: "checkmark.seal")
                        Label("Pay at door", systemImage: "banknote")
                        Label("Pharmacist", systemImage: "cross.case")
                    }.font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)

                    Section(title: "Description", text: p.description)
                    Section(title: "How to use", text: p.howToUse)
                    Section(title: "Ingredients", text: p.ingredients)

                    Button {
                        let msg = "Hello, I have a question about \(p.brand) \(p.name)"
                        if let u = URL(string: "https://wa.me/96170777608?text=\(msg.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") { UIApplication.shared.open(u) }
                    } label: { Label("Ask a pharmacist on WhatsApp", systemImage: "message").frame(maxWidth: .infinity).padding(12) }
                        .buttonStyle(.bordered).padding(.horizontal)
                }.padding(.bottom, 30)
            } else if failed {
                ContentUnavailable(text: "This product isn't available right now.") { Task { await load() } }
            } else { ProgressView().padding(60) }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let p = product {
                ShareLink(item: URL(string: "https://www.shopsuperyou.com/products/\(p.slug)/")!) { Image(systemName: "square.and.arrow.up") }
            }
        }
        .task { if product == nil { await load() } }
        .sheet(item: $playing) { vid in YouTubeSheet(video: vid) }
        .sheet(isPresented: $howTo) { if let p = product { HowToSheet(product: p, videos: videos) { vid in howTo = false; playing = vid } } }
    }

    func load() async {
        do {
            let p = try await API.product(slug)
            product = p; selected = p.variants.first(where: { $0.inStock }) ?? p.variants.first; failed = false
            let cfg = await API.sharedConfig()
            subscribe = cfg?.features?.subscribe
            spCfg = cfg?.features?.superPrice
            bulkCfg = cfg?.features?.bulk
            videos = (try? await API.videos(slug))?.videos ?? []
        } catch { failed = true }
    }
}

private struct Section: View {
    let title: String; let text: String
    @State private var open = false
    var body: some View {
        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            DisclosureGroup(isExpanded: $open) {
                Text(text).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
            } label: { Text(title).font(.subheadline.bold()).foregroundStyle(Color.ink) }
            .padding(.horizontal)
            Divider().padding(.horizontal)
        }
    }
}

private func card(_ p: Product, _ v: Variant) -> Card {
    Card(id: v.id, slug: p.slug, name: p.name, brand: p.brand, price: v.price, compareAt: v.compareAt, image: v.image.isEmpty ? p.images.first : v.image, inStock: v.inStock, variantCount: p.variants.count, priceMax: nil, origin: v.origin, shipFrom: v.shipFrom, daysMin: v.daysMin, daysMax: v.daysMax)
}

/// Plays a YouTube video inside the app; the X closes it and you're back on the product.
struct YouTubeSheet: View {
    let video: Video
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            WebView(url: URL(string: "https://www.youtube-nocookie.com/embed/\(video.id)?autoplay=1&playsinline=1&rel=0")!)
                .background(Color.black)
                .navigationTitle(video.title).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { dismiss() } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel("Close") } }
        }
    }
}

/// Directions, pharmacist tips and videos in one place.
struct HowToSheet: View {
    let product: Product
    let videos: [Video]
    let play: (Video) -> Void
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                if !product.howToUse.isEmpty { SwiftUI.Section("Directions") { Text(product.howToUse).font(.footnote) } }
                if let t = product.tips, !t.isEmpty { SwiftUI.Section("Pharmacist tips") { ForEach(t, id: \.self) { Text($0).font(.footnote) } } }
                if !videos.isEmpty {
                    SwiftUI.Section("Videos") {
                        ForEach(videos) { v in Button { play(v) } label: { Label(v.title, systemImage: "play.rectangle.fill").font(.footnote) } }
                    }
                }
                SwiftUI.Section { Text("Patch-test new products on a small area first. Stop and ask a pharmacist if your skin reacts.").font(.caption).foregroundStyle(.secondary) }
            }
            .navigationTitle("How to use").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }
}


/// "How to use", always shown and highlighted: the AI guide for this product (or the maker's
/// directions), tips for this kind of product, and videos of this exact product.
struct HowToBox: View {
    let product: Product
    let videos: [Video]
    let play: (Video) -> Void
    @State private var open = false
    var body: some View {
        let g = product.guide
        let steps = g?.steps ?? []
        if !steps.isEmpty || !product.howToUse.isEmpty || !(product.tips ?? []).isEmpty || !videos.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Button { withAnimation(.easeInOut(duration: 0.25)) { open.toggle() } } label: {
                    HStack {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.rose)
                        Text("How to use").font(.headline).foregroundStyle(Color.ink)
                        Spacer()
                        Image(systemName: "chevron.down").rotationEffect(.degrees(open ? 180 : 0)).foregroundStyle(.secondary)
                    }.contentShape(Rectangle())
                }.buttonStyle(.plain)
                if open {
                if let w = g?.when, !w.isEmpty { Text(w).font(.caption.bold()).foregroundStyle(Color.rose).padding(.horizontal, 8).padding(.vertical, 3).background(Color.white, in: Capsule()) }
                if let gf = g?.goodFor, !gf.isEmpty { Text(gf).font(.footnote).foregroundStyle(.secondary) }
                if !steps.isEmpty {
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                        HStack(alignment: .top, spacing: 10) {
                            Text("\(i + 1)").font(.caption.bold()).foregroundStyle(.white).frame(width: 22, height: 22).background(Color.ink, in: Circle())
                            Text(s).font(.subheadline)
                        }
                    }
                } else if !product.howToUse.isEmpty {
                    Text(product.howToUse).font(.subheadline)
                }
                let notes = (product.tips ?? []) + (g?.cautions ?? [])
                if !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) { ForEach(notes, id: \.self) { Text("✦ \($0)").font(.footnote) } }
                        .padding(10).frame(maxWidth: .infinity, alignment: .leading).background(Color.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 12))
                }
                if !videos.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(videos) { v in
                                Button { play(v) } label: {
                                    VStack(alignment: .leading, spacing: 3) {
                                        ZStack(alignment: .topLeading) {
                                            RemoteImage(url: "https://i.ytimg.com/vi/\(v.id)/mqdefault.jpg").frame(width: 180, height: 101).clipShape(RoundedRectangle(cornerRadius: 10))
                                            Image(systemName: "play.circle.fill").font(.display(34)).foregroundStyle(.white).frame(width: 180, height: 101)
                                            if !v.langName.isEmpty { Text(v.langName).font(.caption2.bold()).padding(.horizontal, 6).padding(.vertical, 2).background(.white, in: Capsule()).padding(6) }
                                        }
                                        Text(v.title).font(.caption2).lineLimit(2).frame(width: 180, alignment: .leading)
                                    }
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                }
                if !videos.isEmpty { Text("Videos are made by independent creators on YouTube, not by SuperYou or the brand, for information only. Opinions and results are the creators' own. Always follow the label and ask our pharmacist if unsure.").font(.caption2).foregroundStyle(.secondary) }
                Text(steps.isEmpty ? "Always read the label; ask our pharmacist if unsure." : "Written by SuperYou AI from the manufacturer's directions. Always read the label.").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(LinearGradient(colors: [Color(hex: "#fdeef3"), .white], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.rose.opacity(0.4), lineWidth: 2))
        }
    }
}
