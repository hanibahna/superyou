import SwiftUI

struct CardView: View {
    let card: Card
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                RemoteImage(url: card.image ?? "").padding(8).frame(height: 150).frame(maxWidth: .infinity).background(Color.white)
                if let c = card.compareAt, c > card.price {
                    Text("-\(Int(((1 - card.price / c) * 100).rounded()))%").font(.caption2.bold()).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 3).background(Color.rose, in: RoundedRectangle(cornerRadius: 6)).padding(6)
                }
            }.clipShape(RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "#eee5ea")))
            Text(card.brand.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
            Text(card.name).font(.footnote).foregroundStyle(Color.ink).lineLimit(2).multilineTextAlignment(.leading)
            ShipBadge(origin: card.origin, shipFrom: card.shipFrom, daysMin: card.daysMin, daysMax: card.daysMax)
            HStack(spacing: 6) {
                Text(((card.variantCount ?? 1) > 1 ? "From " : "") + money(card.shownPrice)).font(.subheadline.bold()).foregroundStyle(card.compareAt != nil ? Color.rose : Color.ink)
                if let c = card.compareAt, c > card.shownPrice { Text(money(c)).font(.caption).strikethrough().foregroundStyle(.secondary) }
            }
            if card.matchWas != nil { SuperPricePill() }
            if !card.inStock { Text("Out of stock").font(.caption2).foregroundStyle(.secondary) }
        }
    }
}

struct ProductListView: View {
    let title: String
    let query: String
    @State private var items: [Card] = []
    @State private var page = 1
    @State private var pages = 1
    @State private var total = 0
    @State private var loading = false
    @State private var origin = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Ships from", selection: $origin) {
                    Text("All").tag(""); Text("Lebanon").tag("local"); Text("Imported").tag("international")
                }.pickerStyle(.segmented).padding(.horizontal)
                Text("\(total) products").font(.footnote).foregroundStyle(.secondary).padding(.horizontal)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 18) {
                    ForEach(items) { c in
                        NavigationLink(value: c) { CardView(card: c) }.buttonStyle(.plain)
                            .onAppear { if c == items.last && page < pages { Task { await load(page + 1) } } }
                    }
                }.padding(.horizontal)
                if loading { ProgressView().frame(maxWidth: .infinity).padding() }
                if !loading && items.isEmpty { Text("Nothing here yet.").foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(40) }
            }.padding(.vertical)
        }
        .navigationTitle(title)
        .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
        .task { if items.isEmpty { await load(1) } }
        .onChange(of: origin) { _, _ in Task { items = []; await load(1) } }
    }

    func load(_ p: Int) async {
        guard !loading else { return }
        loading = true; defer { loading = false }
        let q = origin.isEmpty ? query : query + (query.isEmpty ? "" : "&") + "origin=\(origin)"
        if let r = try? await API.products(q, page: p) {
            items = p == 1 ? r.items : items + r.items
            page = r.page; pages = r.pages; total = r.total
        }
    }
}

struct ShopView: View {
    @State private var who = ""
    @State private var text = ""
    @State private var submitted = ""
    private let cats: [(String, String)] = [("Skin care", "collection=skin-care"), ("Make up", "collection=make-up"), ("Fragrance", "collection=fragrances"), ("Hair", "collection=hair-expert"), ("Bath & body", "collection=bath-body"), ("Baby & mom", "collection=baby-mom"), ("Supplements", "category=supplements"), ("Parapharmacy", "collection=parapharmacy"), ("Imported from the USA", "origin=international"), ("On sale", "sale=1")]
    var body: some View {
        NavigationStack {
            Group {
                if submitted.isEmpty {
                    List {
                        Picker("For", selection: $who) { Text("Everyone").tag(""); Text("Women").tag("women"); Text("Men").tag("men") }.pickerStyle(.segmented)
                        ForEach(cats, id: \.0) { c in NavigationLink(c.0) { ProductListView(title: c.0, query: c.1 + (who.isEmpty ? "" : "&for=\(who)")) } }
                    }
                } else {
                    ProductListView(title: "“\(submitted)”", query: "q=\(submitted.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" + (who.isEmpty ? "" : "&for=\(who)")).id(submitted + who)
                }
            }
            .navigationTitle("Shop")
            .searchable(text: $text, prompt: "Products, brands or concerns")
            .onSubmit(of: .search) { submitted = text.trimmingCharacters(in: .whitespaces) }
            .onChange(of: text) { _, t in if t.isEmpty { submitted = "" } }
        }
    }
}
