import SwiftUI
import UIKit
import CoreText

/// The website's look (Admin › Theme and Layout), cached so the app opens in the right colours.
/// Defaults match the live site: Noir & Rose colours with the "Pop" layout (Space Grotesk headings, pill buttons).
enum SiteTheme {
    static let d = UserDefaults.standard
    static var primary: String { d.string(forKey: "theme.primary") ?? "#111111" }
    static var ink: String { d.string(forKey: "theme.ink") ?? "#000000" }
    static var sale: String { d.string(forKey: "theme.sale") ?? "#c0587a" }
    static var background: String { d.string(forKey: "theme.background") ?? "#ffffff" }
    static var grotesk: Bool { (d.string(forKey: "theme.headingFont") ?? "grotesk") == "grotesk" }
    static var pill: Bool { (d.string(forKey: "theme.buttons") ?? "pill") == "pill" }

    /// Save the site's theme from the app config; returns true when something changed.
    @discardableResult static func apply(_ t: Config.Theme?) -> Bool {
        guard let t else { return false }
        let pairs: [(String, String?)] = [("theme.primary", t.primary), ("theme.ink", t.ink), ("theme.sale", t.sale), ("theme.background", t.background), ("theme.headingFont", t.headingFont), ("theme.buttons", t.buttons)]
        var changed = false
        for (k, v) in pairs where v != nil && !(v!.isEmpty) && d.string(forKey: k) != v { d.set(v, forKey: k); changed = true }
        return changed
    }

    /// Navigation titles in the heading font, like the website's page titles.
    static func styleNavigationBars() {
        guard grotesk else { return }
        func grot(_ size: CGFloat) -> UIFont { UIFont(name: "SpaceGrotesk-Bold", size: size) ?? .systemFont(ofSize: size, weight: .bold) }
        let large = grot(32), small = grot(17)
        let a = UINavigationBar.appearance()
        a.largeTitleTextAttributes = [.font: large]
        a.titleTextAttributes = [.font: small]
    }

    /// Bundled Space Grotesk, registered once at launch.
    static func registerFonts() {
        for name in ["SpaceGrotesk-Bold", "SpaceGrotesk-Medium"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf") { CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) }
        }
    }
}

extension Font {
    /// Headings in the website's heading font (Space Grotesk), falling back to the system font.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
        SiteTheme.grotesk ? .custom([.regular, .medium, .light, .thin, .ultraLight].contains(weight) ? "SpaceGrotesk-Medium" : "SpaceGrotesk-Bold", size: size) : .system(size: size, weight: weight)
    }
}

extension Color {
    /// Buttons and selected states: the site's primary colour.
    static var brand: Color { Color(hex: SiteTheme.primary) }
    /// Text.
    static var ink: Color { Color(hex: SiteTheme.ink) }
    /// Accents, sale prices and highlights: the site's rose.
    static var rose: Color { Color(hex: SiteTheme.sale) }
    /// Soft rose tint for chips and selected cards.
    static var blush: Color { Color(hex: SiteTheme.sale).opacity(0.14) }
    /// Tinted card background, as on the website's product cards.
    static var paper: Color { Color(hex: SiteTheme.sale).opacity(0.06) }
    static let indigoShip = Color(red: 0.216, green: 0.188, blue: 0.639)
    static let greenShip = Color(red: 0.016, green: 0.424, blue: 0.306)

    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces); if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0xf5f0eb
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

struct RemoteImage: View {
    let url: String
    var fit: ContentMode = .fit
    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let img): img.resizable().aspectRatio(contentMode: fit)
            case .failure: Image(systemName: "photo").foregroundStyle(.secondary)
            default: Color.paper
            }
        }
    }
}

/// "● Lebanon · 1–3 days" or "✈ USA · 10–14 days".
struct ShipBadge: View {
    let origin: String?; let shipFrom: String?; let daysMin: Int?; let daysMax: Int?
    var body: some View {
        let intl = origin == "international"
        let days = (daysMin != nil && daysMax != nil) ? "\(daysMin!)–\(daysMax!) days" : ""
        HStack(spacing: 4) {
            Image(systemName: intl ? "airplane" : "circle.fill").font(.system(size: intl ? 10 : 6))
            Text(intl ? "\(shipFrom ?? "Imported")" : "Lebanon").fontWeight(.semibold)
            if !days.isEmpty { Text("· \(days)") }
        }
        .font(.caption2)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .foregroundStyle(intl ? Color.indigoShip : Color.greenShip)
        .background((intl ? Color(hex: "#eef2ff") : Color(hex: "#ecfdf3")), in: Capsule())
    }
}


/// Confetti burst with a success haptic, for reached goals (free delivery, order placed).
struct Confetti: View {
    @Binding var fire: Int
    @State private var pieces: [Piece] = []
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    struct Piece: Identifiable { let id = UUID(); let x: CGFloat; let dx: CGFloat; let rot: Double; let color: Color; let size: CGFloat; let delay: Double }
    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(pieces) { p in Drop(p: p, height: geo.size.height) }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: fire) { _, _ in
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            guard !reduceMotion else { return }
            let colors: [Color] = [.rose, .ink, Color(hex: "#ffc2d4"), Color(hex: "#f6d365"), Color(hex: "#e48aa9")]
            pieces = (0..<70).map { i in Piece(x: .random(in: 0.05...0.95), dx: .random(in: -60...60), rot: .random(in: -540...540), color: colors[i % colors.count], size: .random(in: 6...11), delay: .random(in: 0...0.35)) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { pieces = [] }
        }
    }
    struct Drop: View {
        let p: Piece; let height: CGFloat
        @State private var down = false
        var body: some View {
            GeometryReader { g in
                RoundedRectangle(cornerRadius: 2).fill(p.color).frame(width: p.size, height: p.size * 0.5)
                    .rotationEffect(.degrees(down ? p.rot : 0))
                    .position(x: g.size.width * p.x + (down ? p.dx : 0), y: down ? height + 20 : -10)
                    .opacity(down ? 0.2 : 1)
                    .onAppear { withAnimation(.easeIn(duration: 1.8).delay(p.delay)) { down = true } }
            }
        }
    }
}
