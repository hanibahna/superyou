import SwiftUI

struct ProductView: View {
    let slug: String
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
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
                    VStack(alignment: .leading, spacing: 8) {
                        Text(p.brand.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(p.name).font(.title3.bold())
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

                    Button {
                        bag.add(p, v); added = true
                    } label: {
                        Text(v.inStock ? (added ? "Added ✓  ·  Add another" : "Add to bag") : "Out of stock").font(.headline).frame(maxWidth: .infinity).padding()
                    }
                    .buttonStyle(.borderedProminent).tint(Color.ink).disabled(!v.inStock).padding(.horizontal)
                    if added { Button("Go to bag") { router.tab = 2 }.frame(maxWidth: .infinity) }

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
    }

    func load() async {
        do {
            let p = try await API.product(slug)
            product = p; selected = p.variants.first(where: { $0.inStock }) ?? p.variants.first; failed = false
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
