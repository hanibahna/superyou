import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: Router
    @State private var home: Home?
    @State private var error: String?
    @State private var link: Link?

    struct Link: Identifiable, Hashable { let id = UUID(); let title: String; let query: String }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Promise()
                    if let h = home {
                        if !h.banners.isEmpty { Banners(banners: h.banners) { b in open(b.href, b.title) } }
                        if !h.categories.isEmpty {
                            Text("Shop by category").font(.title3.bold()).padding(.horizontal)
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 14) {
                                    ForEach(h.categories, id: \.self) { c in
                                        Button { open(c.href, c.title) } label: {
                                            VStack(spacing: 6) {
                                                RemoteImage(url: c.image).padding(10).frame(width: 84, height: 84).background(Color(hex: c.bg), in: Circle())
                                                Text(c.title).font(.caption.weight(.semibold)).foregroundStyle(Color.ink)
                                            }
                                        }
                                    }
                                }.padding(.horizontal)
                            }
                        }
                        ForEach(h.rows, id: \.title) { r in
                            HStack {
                                Text(r.title).font(.title3.bold())
                                Spacer()
                                Button("See all") { link = Link(title: r.title, query: r.query) }.font(.subheadline.weight(.semibold))
                            }.padding(.horizontal)
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(alignment: .top, spacing: 12) { ForEach(r.items) { c in NavigationLink(value: c) { CardView(card: c).frame(width: 160) }.buttonStyle(.plain) } }.padding(.horizontal)
                            }
                        }
                    } else if let e = error {
                        ContentUnavailable(text: e) { Task { await load() } }
                    } else { ProgressView().frame(maxWidth: .infinity).padding(40) }
                }.padding(.vertical)
            }
            .refreshable { await load() }
            .navigationTitle("SuperYou")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
            .navigationDestination(item: $link) { ProductListView(title: $0.title, query: $0.query) }
            .navigationDestination(item: $openProduct) { ProductView(slug: $0.slug) }
            .task { if home == nil { await load() } }
            .onChange(of: router.pendingLink) { _, l in if let l { router.pendingLink = nil; open(l, "SuperYou") } }
        }
    }

    func load() async {
        do { home = try await API.home(); error = nil } catch { self.error = "We couldn't load the shop. Check your connection." }
    }
    func open(_ href: String, _ title: String) {
        if href.hasPrefix("/products/") {
            link = nil
            let slug = href.replacingOccurrences(of: "/products/", with: "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            openProduct = ProductLink(slug: slug)
        } else if href.hasPrefix("/routine") || href.contains("wa.me") {
            if let u = URL(string: href.hasPrefix("http") ? href : "https://www.shopsuperyou.com\(href)") { UIApplication.shared.open(u) }
        } else { link = Link(title: title, query: query(fromHref: href)) }
    }
    @State private var openProduct: ProductLink?
}

struct ProductLink: Identifiable, Hashable { var id: String { slug }; let slug: String }

struct Promise: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("REVEAL THE SUPER IN YOU").font(.caption2.weight(.bold)).kerning(2).foregroundStyle(Color.rose)
            Text("Every product original. Every question answered. Every order at your door, paid when it arrives.").font(.subheadline.weight(.semibold))
        }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.blush.opacity(0.6), in: RoundedRectangle(cornerRadius: 16)).padding(.horizontal)
    }
}

struct Banners: View {
    let banners: [Banner]
    let tap: (Banner) -> Void
    @State private var page = 0
    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(banners.enumerated()), id: \.offset) { i, b in
                Button { tap(b) } label: {
                    ZStack(alignment: .bottomLeading) {
                        RemoteImage(url: b.image, fit: .fill).frame(maxWidth: .infinity).frame(height: 230).clipped()
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.eyebrow.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose)
                            Text(b.title).font(.title3.bold()).foregroundStyle(Color.ink)
                            Text(b.cta).font(.caption.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 6).background(Color.ink, in: Capsule()).foregroundStyle(.white)
                        }.padding(14).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14)).padding(10)
                    }.clipShape(RoundedRectangle(cornerRadius: 18)).padding(.horizontal)
                }.buttonStyle(.plain).tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .frame(height: 250)
        .task { while !Task.isCancelled { try? await Task.sleep(nanoseconds: 6_000_000_000); withAnimation { page = (page + 1) % max(banners.count, 1) } } }
    }
}

struct ContentUnavailable: View {
    let text: String; let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.slash").font(.largeTitle).foregroundStyle(.secondary)
            Text(text).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Try again", action: retry).buttonStyle(.borderedProminent)
        }.frame(maxWidth: .infinity).padding(40)
    }
}
