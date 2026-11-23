import Foundation

// What the shop's app API returns (https://www.shopsuperyou.com/api/app/v1/…). No supplier data.

struct Card: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let brand: String
    let price: Double
    let compareAt: Double?
    let image: String?
    let inStock: Bool
    let variantCount: Int?
    let priceMax: Double?
    let origin: String?
    let shipFrom: String?
    let daysMin: Int?
    let daysMax: Int?
}

struct Banner: Codable, Hashable { let eyebrow: String; let title: String; let text: String; let cta: String; let href: String; let image: String }
struct Category: Codable, Hashable { let title: String; let href: String; let image: String; let bg: String }
struct Row: Codable, Hashable { let title: String; let query: String; let items: [Card] }
struct Home: Codable { let banners: [Banner]; let categories: [Category]; let rows: [Row]; var sections: [HomeSection]? = nil }
/// One block of the website's home page, in the same order as on shopsuperyou.com.
struct HomeSection: Codable, Identifiable {
    struct Item: Codable, Hashable { var eyebrow: String?; var title: String; var text: String?; var cta: String?; var href: String; var image: String?; var bg: String?; var badge: String? }
    let type: String; let id: String
    var eyebrow: String?; var title: String?; var text: String?; var badge: String?
    var cta: String?; var href: String?; var cta2: String?; var href2: String?; var endsAt: String?
    var items: [Item]?; var cards: [Card]?
}
struct ProductPage: Codable { let items: [Card]; let total: Int; let page: Int; let pages: Int }

struct Variant: Codable, Identifiable, Hashable {
    let id: String; let name: String; let price: Double; let compareAt: Double?; let inStock: Bool; let image: String
    let origin: String; let shipFrom: String; let daysMin: Int; let daysMax: Int
}
struct Product: Codable {
    let slug: String; let name: String; let brand: String; let images: [String]
    let description: String; let howToUse: String; let ingredients: String
    let rating: Double?; let reviewCount: Int; let variants: [Variant]
    let category: String?; let tips: [String]?; let subscribable: Bool?; let url: String?
    var guide: Guide? = nil
    var life: Life? = nil
}
/// How long the product lasts (AI estimate) and how often to deliver it, in months.
struct Life: Codable { let days: Int; let every: Int; let basis: String }
/// "How to use" written once per product by SuperYou AI from the product's own details.
struct Guide: Codable { let steps: [String]; let when: String; let goodFor: String; let cautions: [String] }

struct Video: Codable, Identifiable, Hashable { let id: String; let title: String; let channel: String?; var lang: String? = nil
    var langName: String { switch lang { case "fr": return "Français"; case "ar": return "العربية"; case "en": return "English"; default: return "" } }
}
struct VideoList: Codable { let videos: [Video] }

struct Zone: Codable, Hashable { let name: String; let fee: Double? }
struct Payment: Codable, Hashable { let id: String; let label: String; let description: String? }
struct Config: Codable {
    struct Store: Codable { let name: String; let tagline: String; let whatsapp: String; let phone: String; let email: String }
    struct Delivery: Codable { let fee: Double; let freeThreshold: Double; let estimate: String; let zones: [Zone] }
    struct Advisor: Codable { let name: String; let greeting: String; let suggestions: [String] }
    struct Subscribe: Codable { let monthly: Double; let quarterly: Double; let note: String; var unlockMonthly: Int? = nil; var unlockQuarterly: Int? = nil }
    struct Club: Codable { let name: String; let pointsPerDollar: Double; let rewardPoints: Int; let rewardValue: Double }
    struct Features: Codable { let superScan: Bool; let advisor: Advisor?; let subscribe: Subscribe?; var club: Club? = nil }
    struct Service: Codable, Identifiable, Hashable { let id: String; let title: String; let category: String; let description: String; let duration: Int; let price: Double; let priceNote: String; let video: String }
    struct Theme: Codable { var primary: String?; var ink: String?; var sale: String?; var background: String?; var headingFont: String?; var buttons: String?; var cards: String?; var preset: String? }
    let store: Store; let delivery: Delivery; let payments: [Payment]; let minOrder: Double
    let features: Features?; let services: [Service]?
    var theme: Theme? = nil
}

struct Quote: Codable {
    struct Line: Codable { let productId: String; let price: Double; let compareAt: Double?; let available: Bool }
    struct Discount: Codable { let name: String; let amount: Double }
    let lines: [Line]; let subtotal: Double; let discounts: [Discount]; let discountTotal: Double; let delivery: Double; let total: Double
    let couponError: String?
}

struct CheckoutReply: Codable {
    struct Next: Codable { let redirect: String }
    let orderId: String?; let next: Next?; let confirmUrl: String?; let error: String?; var message: String? = nil
}

struct OrderLine: Codable, Hashable { let name: String; let qty: Int; let lineTotal: Double }
struct Order: Codable, Identifiable, Hashable {
    let id: String; let createdAt: String; let status: String; let total: Double; let lines: [OrderLine]
}
struct Member: Codable { let name: String; let points: Int; let tier: String; let ref: String? }
struct Account: Codable { let member: Member?; let orders: [Order] }

/** One line in the bag (kept on the phone). */
struct BagLine: Codable, Identifiable, Hashable {
    var id: String { productId }
    let productId: String; let slug: String; let name: String; let brand: String; let variant: String
    var price: Double; let image: String; var qty: Int; let origin: String
    var every: Int? = nil // Subscribe & save: 1 = monthly, 3 = quarterly
}
