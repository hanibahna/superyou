import SwiftUI
import WebKit

/// A section of the website shown inside the app (finders, brands, gift cards, info pages…).
/// The site hides its own header, footer and tab bar for the app, products open natively,
/// and "Add to bag" on these pages goes straight into the app's bag.
struct SitePage: View {
    let title: String; let path: String
    @EnvironmentObject private var bag: Bag
    @State private var dest: SiteDest?
    @State private var loading = true
    var body: some View {
        ZStack {
            SiteWeb(url: API.url(path), loading: $loading, open: { dest = $0 }, add: { card, qty in for _ in 0..<max(1, qty) { bag.addCard(card) } })
            if loading { ProgressView() }
        }
        .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $dest) { d in
            switch d {
            case .product(let slug): ProductView(slug: slug)
            case .list(let t, let q): ProductListView(title: t, query: q)
            case .page(let t, let p): SitePage(title: t, path: p)
            }
        }
    }
}

enum SiteDest: Hashable { case product(String), list(String, String), page(String, String) }

struct SiteWeb: UIViewRepresentable {
    let url: URL
    @Binding var loading: Bool
    let open: (SiteDest) -> Void
    let add: (Card, Int) -> Void

    func makeCoordinator() -> Coord { Coord(self) }
    func makeUIView(context: Context) -> WKWebView {
        let c = WKWebViewConfiguration()
        c.allowsInlineMediaPlayback = true
        c.applicationNameForUserAgent = "SuperYouApp/1"
        c.userContentController.add(context.coordinator, name: "superyouBag")
        let w = WKWebView(frame: .zero, configuration: c)
        w.navigationDelegate = context.coordinator
        w.allowsBackForwardNavigationGestures = true
        w.load(URLRequest(url: url))
        return w
    }
    func updateUIView(_ uiView: WKWebView, context: Context) { context.coordinator.parent = self }

    final class Coord: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: SiteWeb
        init(_ p: SiteWeb) { parent = p }

        func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let u = a.request.url else { return decisionHandler(.allow) }
            let host = u.host ?? ""
            // First load and in-page loads stay; only taps on links are routed.
            if a.navigationType != .linkActivated { return decisionHandler(.allow) }
            if !host.hasSuffix("shopsuperyou.com") {
                UIApplication.shared.open(u); return decisionHandler(.cancel)
            }
            let p = u.path
            let title = (a.targetFrame == nil ? "" : "")
            if p.hasPrefix("/products/") {
                let slug = p.dropFirst("/products/".count).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                parent.open(.product(slug)); return decisionHandler(.cancel)
            }
            if p.hasPrefix("/collections/") || p.hasPrefix("/brands/") && p.count > "/brands/".count || p.hasPrefix("/shop") {
                let name = p.split(separator: "/").last.map { $0.replacingOccurrences(of: "-", with: " ").capitalized } ?? "Shop"
                parent.open(.list(title.isEmpty ? name : title, query(fromHref: u.absoluteString))); return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        }
        func webView(_ w: WKWebView, didStartProvisionalNavigation n: WKNavigation!) { parent.loading = true }
        func webView(_ w: WKWebView, didFinish n: WKNavigation!) { parent.loading = false }
        func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { parent.loading = false }

        // Web "Add to bag" → the app's bag.
        func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
            guard let d = m.body as? [String: Any], let id = d["id"] as? String, let slug = d["slug"] as? String else { return }
            let card = Card(id: id, slug: slug, name: d["name"] as? String ?? "", brand: d["brand"] as? String ?? "", price: d["price"] as? Double ?? 0, compareAt: d["compareAt"] as? Double, image: d["image"] as? String, inStock: true, variantCount: 1, priceMax: nil, origin: d["origin"] as? String ?? "local", shipFrom: nil, daysMin: nil, daysMax: nil)
            parent.add(card, d["qty"] as? Int ?? 1)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}

/// The website's guided product finders.
struct FindersView: View {
    private let list = [("Sun finder", "sun"), ("Make-up finder", "makeup"), ("Hair finder", "hair"), ("Body finder", "body"), ("Scent finder", "fragrance"), ("Baby finder", "baby"), ("Supplement finder", "supplements")]
    var body: some View {
        List(list, id: \.1) { t, id in NavigationLink(t) { SitePage(title: t, path: "/finder/\(id)/") } }.navigationTitle("Product finders")
    }
}
