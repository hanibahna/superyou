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
    @State private var f = ListFilter()
    @State private var facets: Facets?
    @State private var showFilters = false
    @State private var failed = false

    static let sorts: [(String, String)] = [("", "Featured"), ("price-asc", "Price: low to high"), ("price-desc", "Price: high to low"), ("discount", "Biggest discount"), ("new", "New arrivals")]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Ships from", selection: $origin) {
                    Text("All").tag(""); Text("Lebanon").tag("local"); Text("Imported").tag("international")
                }.pickerStyle(.segmented).padding(.horizontal)
                HStack(spacing: 10) {
                    Menu {
                        Picker("Sort by", selection: $f.sort) { ForEach(Self.sorts, id: \.0) { Text($0.1).tag($0.0) } }
                    } label: {
                        Label(Self.sorts.first { $0.0 == f.sort }?.1 ?? "Sort", systemImage: "arrow.up.arrow.down").font(.footnote.weight(.semibold))
                            .padding(.horizontal, 12).padding(.vertical, 8).overlay(Capsule().stroke(Color(hex: "#eee5ea")))
                    }
                    Button { showFilters = true } label: {
                        Label(f.count > 0 ? "Filters (\(f.count))" : "Filters", systemImage: "line.3.horizontal.decrease").font(.footnote.weight(.semibold))
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .foregroundStyle(f.count > 0 ? .white : Color.ink)
                            .background(f.count > 0 ? Color.ink : Color.clear, in: Capsule()).overlay(Capsule().stroke(Color(hex: "#eee5ea")))
                    }
                    Spacer()
                    Text("\(total) products").font(.footnote).foregroundStyle(.secondary)
                }.foregroundStyle(Color.ink).padding(.horizontal)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 18) {
                    ForEach(items) { c in
                        NavigationLink(value: c) { CardView(card: c) }.buttonStyle(.plain)
                            .onAppear { if c == items.last && page < pages { Task { await load(page + 1) } } }
                    }
                }.padding(.horizontal)
                if loading { ProgressView().frame(maxWidth: .infinity).padding() }
                if !loading && items.isEmpty && failed {
                    ContentUnavailable(text: "Couldn't load these products.") { Task { await load(1) } }
                } else if !loading && items.isEmpty {
                    VStack(spacing: 10) {
                        Text("Nothing matches.").foregroundStyle(.secondary)
                        if f.count > 0 { Button("Clear filters") { f = ListFilter(sort: f.sort) } }
                    }.frame(maxWidth: .infinity).padding(40)
                }
            }.padding(.vertical)
        }
        .navigationTitle(title)
        .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
        .task { if items.isEmpty { await load(1) } }
        .onChange(of: origin) { _, _ in Task { items = []; await load(1) } }
        .onChange(of: f) { _, _ in Task { items = []; await load(1) } }
        .sheet(isPresented: $showFilters) { FilterSheet(facets: facets, filter: $f, lockedBrand: query.contains("brand=")) }
    }

    func load(_ p: Int) async {
        guard !loading else { return }
        loading = true; defer { loading = false }
        var parts = [query].filter { !$0.isEmpty }
        if !origin.isEmpty { parts.append("origin=\(origin)") }
        parts.append(contentsOf: f.params)
        // Retry once: a list opened while the screen behind it refreshes can have its first request cancelled.
        for attempt in 0..<2 {
            do {
                let r = try await API.products(parts.joined(separator: "&"), page: p)
                items = p == 1 ? r.items : items + r.items
                page = r.page; pages = r.pages; total = r.total; failed = false
                if p == 1, let fc = r.facets, f.count == 0 || facets == nil { facets = fc }
                return
            } catch {
                if attempt == 0 { try? await Task.sleep(nanoseconds: 400_000_000) } else { failed = true }
            }
        }
    }
}

/// What the shopper picked in Sort and Filters (same parameters as the website's /shop).
struct ListFilter: Equatable {
    var sort = ""
    var brands: Set<String> = []
    var concerns: Set<String> = []
    var category = ""
    var sale = false
    var inStock = false
    var min: Double? = nil
    var max: Double? = nil
    var count: Int { brands.count + concerns.count + (category.isEmpty ? 0 : 1) + (sale ? 1 : 0) + (inStock ? 1 : 0) + (min != nil || max != nil ? 1 : 0) }
    var params: [String] {
        let enc = { (s: String) in s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? s }
        var out: [String] = []
        if !sort.isEmpty { out.append("sort=\(sort)") }
        out += brands.sorted().map { "brand=\(enc($0))" }
        out += concerns.sorted().map { "concern=\(enc($0))" }
        if !category.isEmpty { out.append("category=\(enc(category))") }
        if sale { out.append("sale=1") }
        if inStock { out.append("instock=1") }
        if let m = min { out.append("min=\(Int(m))") }
        if let m = max { out.append("max=\(Int(m))") }
        return out
    }
}

struct FilterSheet: View {
    let facets: Facets?
    @Binding var filter: ListFilter
    let lockedBrand: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ListFilter()
    @State private var brandSearch = ""
    @State private var minText = ""
    @State private var maxText = ""
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("On sale only", isOn: $draft.sale)
                    Toggle("In stock only", isOn: $draft.inStock)
                }
                Section("Price ($)") {
                    HStack {
                        TextField(facets.map { "Min \(Int($0.price.first ?? 0))" } ?? "Min", text: $minText).keyboardType(.numberPad)
                        Text("–").foregroundStyle(.secondary)
                        TextField(facets.map { "Max \(Int($0.price.last ?? 0))" } ?? "Max", text: $maxText).keyboardType(.numberPad)
                    }
                }
                if let c = facets?.categories, c.count > 1 {
                    Section("Category") {
                        Picker("Category", selection: $draft.category) {
                            Text("All").tag("")
                            ForEach(c, id: \.slug) { Text("\($0.name) (\($0.count))").tag($0.slug) }
                        }
                    }
                }
                if let c = facets?.concerns, !c.isEmpty {
                    Section("Concern") {
                        ForEach(c, id: \.slug) { t in check(t.name, t.count, draft.concerns.contains(t.slug)) { toggle(&draft.concerns, t.slug) } }
                    }
                }
                if !lockedBrand, let b = facets?.brands, b.count > 1 {
                    Section("Brand") {
                        TextField("Search brands", text: $brandSearch)
                        ForEach(b.filter { brandSearch.isEmpty || $0.name.localizedCaseInsensitiveContains(brandSearch) }.prefix(40), id: \.name) { x in
                            check(x.name, x.count, draft.brands.contains(x.name)) { toggle(&draft.brands, x.name) }
                        }
                    }
                }
            }
            .navigationTitle("Filters").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Clear") { draft = ListFilter(sort: draft.sort); minText = ""; maxText = "" } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Show results") {
                        draft.min = Double(minText); draft.max = Double(maxText)
                        filter = draft; dismiss()
                    }.bold()
                }
            }
            .onAppear {
                draft = filter
                minText = filter.min.map { String(Int($0)) } ?? ""; maxText = filter.max.map { String(Int($0)) } ?? ""
            }
        }
    }
    private func check(_ name: String, _ count: Int, _ on: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack {
                Image(systemName: on ? "checkmark.square.fill" : "square").foregroundStyle(on ? Color.ink : .secondary)
                Text(name).foregroundStyle(Color.ink)
                Spacer()
                Text("\(count)").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
    private func toggle(_ s: inout Set<String>, _ v: String) { if s.contains(v) { s.remove(v) } else { s.insert(v) } }
}

struct ShopView: View {
    @State private var who = ""
    @State private var text = ""
    @State private var submitted = ""
    // Shown until the website's menu loads (and if it can't): categories that always have products.
    private let cats: [(String, String)] = [("Skin care", "category=skincare"), ("Make up", "category=makeup"), ("Hair", "category=hair"), ("Fragrance", "category=fragrance"), ("Sun care", "category=suncare"), ("Baby & mom", "category=baby"), ("Supplements", "category=supplements"), ("On sale", "sale=1")]
    @State private var menu: [MenuItem] = []
    @State private var menuTried = false
    @EnvironmentObject private var router: Router
    var body: some View {
        NavigationStack {
            Group {
                if submitted.isEmpty {
                    List {
                        Picker("For", selection: $who) { Text("Everyone").tag(""); Text("Women").tag("women"); Text("Men").tag("men") }.pickerStyle(.segmented)
                        if menu.isEmpty && !menuTried {
                            HStack { Spacer(); ProgressView(); Spacer() }.task { try? await Task.sleep(nanoseconds: 4_000_000_000); menuTried = true }
                        } else if menu.isEmpty {
                            ForEach(cats, id: \.0) { c in NavigationLink(c.0) { ProductListView(title: c.0, query: c.1 + (who.isEmpty ? "" : "&for=\(who)")) } }
                        } else {
                            // Same sections as the website's menu (Women and Men are the picker above).
                            ForEach(menu.filter { !$0.href.contains("for=") }) { m in
                                if m.children.isEmpty {
                                    NavigationLink(m.label) { MenuDest(item: m, onTab: { router.tab = $0 }) }
                                } else {
                                    NavigationLink(m.label) { SubMenu(item: m, onTab: { router.tab = $0 }) }
                                }
                            }
                            NavigationLink("On sale") { ProductListView(title: "On sale", query: "sale=1" + (who.isEmpty ? "" : "&for=\(who)")) }
                        }
                    }
                } else {
                    ProductListView(title: "“\(submitted)”", query: "q=\(submitted.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" + (who.isEmpty ? "" : "&for=\(who)")).id(submitted + who)
                }
            }
            .navigationTitle("Shop")
            .toolbar { ToolbarItem(placement: .topBarLeading) { MenuButton() } }
            .searchable(text: $text, prompt: "Products, brands or concerns")
            .onSubmit(of: .search) { submitted = text.trimmingCharacters(in: .whitespaces) }
            .onChange(of: text) { _, t in if t.isEmpty { submitted = "" } }
            .task {
                if menu.isEmpty, let m = (await API.sharedConfig())?.menu { menu = m }
                if menu.isEmpty, let m = (try? await API.config())?.menu { menu = m }
            }
        }
    }
}
