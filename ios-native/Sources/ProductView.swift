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
                            Text(p.name).font(.title3.bold())
                            Spacer()
                            Button { wishlist.toggle(card(p, v)) } label: {
                                Image(systemName: wishlist.has(p.slug) ? "heart.fill" : "heart").font(.title3).foregroundStyle(Color.rose)
                            }.accessibilityLabel(wishlist.has(p.slug) ? "Remove from wishlist" : "Save to wishlist")
                        }
                        if let r = p.rating, p.reviewCount >= 3 { Label(String(format: "%.1f · %d reviews", r, p.reviewCount), systemImage: "star.fill").font(.footnote).foregroundStyle(Color.rose) }
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(money(v.price)).font(.title2.bold()).foregroundStyle(v.compareAt != nil ? Color.rose : Color.ink)
                            if let c = v.compareAt, c > v.price { Text(money(c)).strikethrough().foregroundStyle(.secondary) }
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

                    if let tips = p.tips, !tips.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Pharmacist tip", systemImage: "lightbulb").font(.caption.weight(.bold)).foregroundStyle(Color.rose)
                            ForEach(tips, id: \.self) { Text("• \($0)").font(.footnote) }
                        }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.blush.opacity(0.6), in: RoundedRectangle(cornerRadius: 12)).padding(.horizontal)
                    }
                    if p.subscribable == true, let s = subscribe {
                        VStack(alignment: .leading, spacing: 8) {
                            Picker("Buy", selection: $every) {
                                Text("Once").tag(Int?.none)
                                Text("Monthly −\(Int(s.monthly))%").tag(Int?.some(1))
                                Text("Every 3 months −\(Int(s.quarterly))%").tag(Int?.some(3))
                            }.pickerStyle(.segmented)
                            if every != nil { Text(s.note).font(.caption).foregroundStyle(.secondary) }
                        }.padding(.horizontal)
                    }
                    Button { howTo = true } label: {
                        Label("How to use", systemImage: "sparkles").font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity).padding(12)
                    }.buttonStyle(.bordered).tint(Color.rose).padding(.horizontal)
                    Button {
                        bag.add(p, v, every: every); added = true
                    } label: {
                        Text(v.inStock ? (added ? "Added ✓  ·  Add another" : "Add to bag") : "Out of stock").font(.headline).frame(maxWidth: .infinity).padding()
                    }
                    .buttonStyle(.borderedProminent).tint(Color.ink).disabled(!v.inStock).padding(.horizontal)
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
            subscribe = await API.sharedConfig()?.features?.subscribe
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
