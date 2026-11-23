import Foundation
import SwiftUI

/// The shopping bag, kept on the phone between launches.
@MainActor
final class Bag: ObservableObject {
    @Published var lines: [BagLine] = [] { didSet { save() } }
    @Published var quote: Quote?
    private let key = "sy.bag"

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode([BagLine].self, from: d) { lines = l }
    }
    private func save() { if let d = try? JSONEncoder().encode(lines) { UserDefaults.standard.set(d, forKey: key) } }

    var count: Int { lines.reduce(0) { $0 + $1.qty } }
    var subtotal: Double { lines.reduce(0) { $0 + $1.price * Double($1.qty) } }
    var mixed: Bool { lines.contains { $0.origin == "international" } && lines.contains { $0.origin != "international" } }

    func add(_ p: Product, _ v: Variant, qty: Int = 1, every: Int? = nil) {
        if let i = lines.firstIndex(where: { $0.productId == v.id }) { lines[i].qty += qty; lines[i].every = every }
        else { lines.append(BagLine(productId: v.id, slug: p.slug, name: p.name, brand: p.brand, variant: v.name == p.name ? "" : v.name, price: v.price, image: v.image.isEmpty ? (p.images.first ?? "") : v.image, qty: qty, origin: v.origin, every: every)) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    func setQty(_ id: String, _ q: Int) {
        if q <= 0 { lines.removeAll { $0.productId == id } } else if let i = lines.firstIndex(where: { $0.productId == id }) { lines[i].qty = q }
    }
    func clear() { lines = []; quote = nil }

    /// Add a product found by the AI advisor or SuperScan (we only have the card, so it opens as the first variant).
    func addCard(_ c: Card) {
        if let i = lines.firstIndex(where: { $0.productId == c.id }) { lines[i].qty += 1 }
        else { lines.append(BagLine(productId: c.id, slug: c.slug, name: c.name, brand: c.brand, variant: "", price: c.price, image: c.image ?? "", qty: 1, origin: c.origin ?? "local")) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Live prices, discounts and delivery from the shop.
    func refresh(zone: String?, code: String?) async {
        guard !lines.isEmpty else { quote = nil; return }
        var body: [String: Any] = ["items": lines.map { l -> [String: Any] in var d: [String: Any] = ["productId": l.productId, "qty": l.qty]; if let e = l.every { d["every"] = e }; return d }]
        if let z = zone, !z.isEmpty { body["zone"] = z }
        if let c = code, !c.isEmpty { body["code"] = c }
        quote = try? await API.post("/api/app/v1/quote", body: body, as: Quote.self)
        if let q = quote { for l in q.lines { if let i = lines.firstIndex(where: { $0.productId == l.productId }), lines[i].price != l.price { lines[i].price = l.price } } }
    }
}
