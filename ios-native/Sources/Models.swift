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
    /// SuperPrice: our usual price before it went below another shop's (cards show the usual price, like the website).
    var matchWas: Double? = nil
    var match: String? = nil
    /// The price shown on grids: the usual price (the SuperPrice discount is revealed on the product page).
    var shownPrice: Double { matchWas ?? price }
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
    var superPrice: SuperPrice? = nil
}
/// SuperPrice for one product: lowered below another shop (was → price), or already the best price, with every shop compared.
struct SuperPrice: Codable, Hashable {
    struct Shop: Codable, Hashable { let name: String; let price: Double }
    let lowered: Bool; let was: Double?; let vs: Double?; let shop: String?; let shops: [Shop]; let partial: Bool
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
    struct Wheel: Codable { let title: String; let text: String; let slices: [String] }
    struct Checkin: Codable { let days: Int; let points: Int }
    struct Game: Codable { let celebrate: Bool; let checkin: Checkin? }
    struct SuperPriceCfg: Codable { let beatPct: Double; let shops: [String] }
    struct AppOffer: Codable { let firstPct: Double; let doublePoints: Bool }
    struct BulkCfg: Codable { let pct: Double; let maxUnits: Int }
    struct Prime: Codable { let name: String; let monthlyPrice: Double; let trialMonths: Int; let trialMinOrder: Double; let freeMin: Double; let unlimitedSuperPrice: Bool; let promoLive: Bool }
    struct Features: Codable { let superScan: Bool; let advisor: Advisor?; let subscribe: Subscribe?; var club: Club? = nil; var wheel: Wheel? = nil; var game: Game? = nil; var superPrice: SuperPriceCfg? = nil; var prime: Prime? = nil; var bulk: BulkCfg? = nil; var appOffer: AppOffer? = nil; var wholesale: Bool? = nil; var videoCalls: Bool? = nil; var eventsOn: Bool? = nil }
    struct Service: Codable, Identifiable, Hashable { let id: String; let title: String; let category: String; let description: String; let duration: Int; let price: Double; let priceNote: String; let video: String }
    struct Theme: Codable { var primary: String?; var ink: String?; var sale: String?; var background: String?; var headingFont: String?; var buttons: String?; var cards: String?; var preset: String? }
    let store: Store; let delivery: Delivery; let payments: [Payment]; let minOrder: Double
    let features: Features?; let services: [Service]?
    var theme: Theme? = nil
    struct PageLink: Codable { let slug: String; let title: String }
    var pages: [PageLink]? = nil
}

struct Quote: Codable {
    struct Line: Codable { let productId: String; let price: Double; let compareAt: Double?; let available: Bool; var matchWas: Double? = nil; var match: String? = nil; var spLimit: Int? = nil; var bulk: BulkLine? = nil }
    struct BulkLine: Codable { let units: Int; let pct: Double; let saving: Double; let left: Int; var business: String? = nil }
    /// SuperPrime for this shopper (by phone) and this bag.
    struct PrimeQ: Codable { let status: String; let until: String?; let trialUsed: Bool; let trialOk: Bool; let choice: String?; let fee: Double; let free: Bool; let known: Bool }
    var prime: PrimeQ? = nil
    struct Discount: Codable { let name: String; let amount: Double }
    let lines: [Line]; let subtotal: Double; let discounts: [Discount]; let discountTotal: Double; let delivery: Double; let total: Double
    let couponError: String?
    struct Routine: Codable { let have: Int; let need: Int; let percent: Double; let steps: [String]; let all: [String] }
    var routine: Routine? = nil
    var doublePointsAt: Double? = nil
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
struct Account: Codable { let member: Member?; let orders: [Order]; var game: GameState? = nil }
/// Badges, review quest, referral race and progress (from the website's Club engine).
struct GameState: Codable {
    struct Badge: Codable, Identifiable { let id: String; let name: String; let text: String; let icon: String; let points: Int; let earned: Bool }
    struct Quest: Codable { let done: Int; let target: Int; let points: Int; let complete: Bool }
    struct RaceStep: Codable, Hashable { let friends: Int; let points: Int; let reached: Bool }
    struct Race: Codable { let friends: Int; let steps: [RaceStep] }
    struct Tier: Codable { let name: String; let next: String?; let toNext: Double; let spend: Double; let progress: Double }
    struct Voucher: Codable { let points: Int; let target: Int; let value: Double }
    let badges: [Badge]; let quest: Quest?; let race: Race?; let tier: Tier; let voucher: Voucher; let newlyEarned: [String]
}

/** One line in the bag (kept on the phone). */
struct BagLine: Codable, Identifiable, Hashable {
    var id: String { productId }
    let productId: String; let slug: String; let name: String; let brand: String; let variant: String
    var price: Double; let image: String; var qty: Int; let origin: String
    var every: Int? = nil // Subscribe & save: 1 = monthly, 3 = quarterly
}
