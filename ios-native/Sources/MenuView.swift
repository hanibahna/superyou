import SwiftUI

/// ☰ menu: the website's header menu (categories, brands, offers…) plus the
/// Discover shortcuts, info pages, WhatsApp and social links. Opened from Home and Shop.
struct MenuButton: View {
    @State private var show = false
    @EnvironmentObject private var router: Router
    @EnvironmentObject private var bag: Bag
    @EnvironmentObject private var wishlist: Wishlist
    var body: some View {
        Button { show = true } label: { Image(systemName: "line.3.horizontal") }
            .accessibilityLabel("Menu")
            .fullScreenCover(isPresented: $show) { MenuView().environmentObject(router).environmentObject(bag).environmentObject(wishlist) }
    }
}

struct MenuView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var router: Router
    @State private var config: Config?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            List {
                if let menu = config?.menu, !menu.isEmpty {
                    Section("Shop") {
                        ForEach(menu) { item in row(item) }
                    }
                } else if loading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
                Section("Discover") {
                    NavigationLink { SitePage(title: "Brands", path: "/brands/") } label: { Label("All brands A–Z", systemImage: "textformat") }
                    Button { go(tab: 2) } label: { Label("SuperScan (3D skin scan)", systemImage: "faceid") }
                    NavigationLink { SitePage(title: "Routine finder", path: "/routine/") } label: { Label("Build my routine", systemImage: "sparkles.rectangle.stack") }
                    NavigationLink { SitePage(title: "Gift cards", path: "/gift-cards/") } label: { Label("Gift cards", systemImage: "giftcard") }
                    NavigationLink { SitePage(title: "SuperYou Club", path: "/club/") } label: { Label("SuperYou Club", systemImage: "star") }
                    if config?.features?.wholesale == true, !(config?.menu ?? []).contains(where: { $0.href.hasPrefix("/wholesale") }) {
                        NavigationLink { WholesaleView() } label: { Label("Wholesale (for businesses)", systemImage: "shippingbox") }
                    }
                }
                if let pages = config?.pages, !pages.isEmpty {
                    Section("Help & info") {
                        ForEach(pages, id: \.slug) { pg in
                            NavigationLink { SitePage(title: pg.title, path: "/pages/\(pg.slug)/") } label: { Text(pg.title) }
                        }
                    }
                }
                Section("Talk to us") {
                    if let w = config?.store.whatsapp, let u = URL(string: "https://wa.me/\(w.filter(\.isNumber))") {
                        Link(destination: u) { Label("WhatsApp us", systemImage: "message") }
                    }
                    if let so = config?.social {
                        ForEach([("Instagram", so.instagram, "camera"), ("TikTok", so.tiktok, "music.note"), ("Facebook", so.facebook, "person.2"), ("YouTube", so.youtube, "play.rectangle")].filter { !($0.1 ?? "").isEmpty }, id: \.0) { name, url, icon in
                            if let u = URL(string: url ?? "") { Link(destination: u) { Label(name, systemImage: icon) } }
                        }
                    }
                }
            }
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { dismiss() } label: { Image(systemName: "xmark") }.accessibilityLabel("Close") } }
            .task {
                // Fresh copy so menu changes in the admin show up without restarting the app.
                if let c = try? await API.config() { config = c } else { config = await API.sharedConfig() }
                loading = false
            }
        }
    }

    @ViewBuilder func row(_ item: MenuItem) -> some View {
        if item.children.isEmpty {
            NavigationLink { MenuDest(item: item, onTab: go) } label: { Text(item.label) }
        } else {
            NavigationLink { SubMenu(item: item, onTab: go) } label: { Text(item.label) }
        }
    }

    func go(tab: Int) { router.tab = tab; dismiss() }
}

/// One level down: "All <section>" first, then its sub-sections.
struct SubMenu: View {
    let item: MenuItem
    let onTab: (Int) -> Void
    var body: some View {
        List {
            if !item.href.isEmpty, item.href != "#" {
                NavigationLink { MenuDest(item: item, onTab: onTab) } label: { Text("All \(item.label.lowercased())").fontWeight(.semibold) }
            }
            ForEach(item.children) { c in
                if c.children.isEmpty {
                    NavigationLink { MenuDest(item: c, onTab: onTab) } label: { Text(c.label) }
                } else {
                    NavigationLink { SubMenu(item: c, onTab: onTab) } label: { Text(c.label) }
                }
            }
        }
        .navigationTitle(item.label).navigationBarTitleDisplayMode(.inline)
    }
}

/// Where a website link goes in the app: products and listings open natively, everything else as a site page.
struct MenuDest: View {
    let item: MenuItem
    let onTab: (Int) -> Void
    var body: some View {
        let h = item.href
        if h.hasPrefix("/products/") {
            ProductView(slug: h.dropFirst("/products/".count).trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        } else if h.hasPrefix("/wholesale") {
            WholesaleView()
        } else if h.hasPrefix("/skin-scan") || h.hasPrefix("/superscan") {
            Color.clear.onAppear { onTab(2) }
        } else if h.hasPrefix("/collections/") || h.hasPrefix("/shop") || (h.hasPrefix("/brands/") && h.count > "/brands/".count) {
            ProductListView(title: item.label, query: query(fromHref: h))
        } else if h.hasPrefix("http"), !h.contains("shopsuperyou.com"), let u = URL(string: h) {
            Color.clear.onAppear { UIApplication.shared.open(u) }
        } else {
            SitePage(title: item.label, path: h.hasPrefix("http") ? (URL(string: h)?.path ?? "/") : h)
        }
    }
}
