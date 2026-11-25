import SwiftUI

// SuperPrice and SuperPrime in the app, matching the website:
// - grids show the usual price; the product page reveals the SuperPrice (usual price struck, new price, −$ · %)
// - the "SuperPrice Guaranteed" card compares every shop, or shows "Lowest price in Lebanon" with a LIVE price watch
// - SuperPrime is chosen at checkout: free trial, join for a month, or already a member.

private let plum = Color(hex: "#9b2c50")
private let mark = Color(hex: "#c0587a")
private let pinkSoft = Color(hex: "#fdecef")
private let pinkLine = Color(hex: "#f3c4d2")
private let okGreen = Color(hex: "#046c4e")
private let okSoft = Color(hex: "#e6f4ee")

private func pct(_ x: Double) -> String { String(format: "%.1f%%", (x * 1000).rounded() / 10) }

/// The round "S" mark.
struct SMark: View {
    var size: CGFloat = 16
    var body: some View {
        Text("S").font(.system(size: size * 0.56, weight: .black)).foregroundStyle(.white)
            .frame(width: size, height: size).background(mark, in: Circle())
    }
}

/// Small pill on product cards: this product has a SuperPrice.
struct SuperPricePill: View {
    var body: some View {
        HStack(spacing: 3) { SMark(size: 12); Text("SuperPrice").font(.system(size: 10, weight: .bold)) }
            .foregroundStyle(plum).padding(.horizontal, 6).padding(.vertical, 3).background(pinkSoft, in: Capsule())
    }
}

/// Product page price: the usual price first, then the SuperPrice comes off it.
struct SuperPriceTag: View {
    let was: Double; let price: Double
    @State private var on = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        let off = was - price
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(money(was)).font(.display(on ? 17 : 22)).strikethrough(on, color: mark).foregroundStyle(on ? .secondary : Color.ink)
                if on { Text(money(price)).font(.display(24)).foregroundStyle(plum).transition(.scale.combined(with: .opacity)) }
            }
            if on {
                HStack(spacing: 5) { SMark(); Text("SuperPrice −\(money(off)) · \(pct(off / was))").font(.footnote.bold()) }
                    .foregroundStyle(plum).padding(.horizontal, 10).padding(.vertical, 5).background(pinkSoft, in: Capsule())
                    .transition(.scale.combined(with: .opacity))
            } else {
                HStack(spacing: 6) { ProgressView().controlSize(.mini); Text("Checking other shops…").font(.caption).foregroundStyle(.secondary) }
            }
        }
        .animation(.spring(duration: 0.5), value: on)
        .task(id: price) {
            on = false
            if !reduceMotion { try? await Task.sleep(for: .seconds(1.1)) }
            on = true
            if !reduceMotion { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
        }
    }
}

/// "SuperPrice Guaranteed": who we compared with and by how much we beat them.
struct SuperPriceCard: View {
    let sp: SuperPrice; let price: Double; let cfg: Config.SuperPriceCfg?
    @State private var stage = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                SMark(); Text("SuperPrice Guaranteed").font(.subheadline.bold()).foregroundStyle(plum)
                if stage >= 2 { Image(systemName: "checkmark.circle.fill").foregroundStyle(okGreen).transition(.scale) }
            }
            if !sp.shops.isEmpty {
                ForEach(Array(sp.shops.enumerated()), id: \.offset) { i, s in shopRow(i, s) }
                if stage >= 2 {
                    HStack { Text("SuperYou").bold(); Spacer(); Text(money(price)).bold() }.font(.subheadline).padding(.top, 4)
                        .overlay(alignment: .top) { Rectangle().fill(pinkLine).frame(height: 1).offset(y: -2) }
                    beatLine
                }
            } else if let vs = sp.vs, let shop = sp.shop {
                Text("\(shop): \(money(vs))").font(.footnote).foregroundStyle(.secondary).strikethrough(sp.lowered)
                if stage >= 2 { Text("SuperYou: \(money(price))").font(.subheadline.bold()) }
            } else {
                NoCheaper(shops: cfg?.shops ?? [])
            }
        }
        .padding(14)
        .background(LinearGradient(colors: [Color(hex: "#fff5f8"), .white], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(pinkLine))
        .animation(.easeOut(duration: 0.35), value: stage)
        .task(id: price) {
            stage = 0
            if reduceMotion { stage = 2; return }
            try? await Task.sleep(for: .seconds(0.9)); stage = 1
            try? await Task.sleep(for: .seconds(0.4 + 0.28 * Double(min(sp.shops.count, 8)))); stage = 2
        }
    }

    @ViewBuilder func shopRow(_ i: Int, _ s: SuperPrice.Shop) -> some View {
        let d = s.price - price
        let before = sp.was ?? price
        let tookOff = sp.lowered && s.price <= before * 1.005
        VStack(alignment: .leading, spacing: 3) {
            HStack { Text(s.name).font(.footnote.weight(.semibold)); Spacer(); Text(money(s.price)).font(.footnote).strikethrough(stage >= 2 && d > 0.009, color: mark).foregroundStyle(.secondary) }
            if stage < 2 { ProgressView(value: 0.4).tint(mark).scaleEffect(y: 0.5) }
            else if d > 0.009 {
                HStack {
                    Text(tookOff ? (abs(s.price - before) < 0.01 * s.price ? "Same price → we took extra off" : "Cheaper there → we took extra off") : "Already cheaper here")
                        .font(.caption2.bold()).foregroundStyle(tookOff ? .white : okGreen)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(tookOff ? plum : okSoft, in: Capsule())
                    Spacer()
                    Text("Beaten by \(money(d)) · \(pct(d / s.price))").font(.caption2.bold()).foregroundStyle(okGreen)
                }.transition(.opacity.combined(with: .scale(scale: 0.9)))
            } else { Text("Same price").font(.caption2.bold()) }
        }
        .padding(6).background(i % 2 == 0 ? pinkSoft.opacity(0.5) : .clear, in: RoundedRectangle(cornerRadius: 8))
        .opacity(stage >= 1 ? 1 : 0).offset(y: stage >= 1 ? 0 : -6)
        .animation(.easeOut(duration: 0.3).delay(Double(i) * 0.28), value: stage)
    }

    var beatLine: some View {
        let beaten = sp.shops.filter { $0.price - price > 0.009 }
        let list = beaten.map { "\($0.name) by \(money($0.price - price)) (\(pct(($0.price - price) / $0.price)))" }.joined(separator: ", ")
        let status = sp.lowered ? (sp.partial ? "Extra discount applied, as far as this item allows." : "Cheaper elsewhere, so we went lower.") : ""
        return (Text(list.isEmpty ? "✓ Same as the lowest price. " : "✓ \(sp.lowered ? "Beats" : "Cheaper than") \(list). ").bold().foregroundColor(okGreen) + Text("\(status) Checked every night.").foregroundColor(.secondary)).font(.caption)
    }
}

/// No shop sells it for less: each shop checked ticks off, then "Lowest price in Lebanon".
struct NoCheaper: View {
    let shops: [String]
    @State private var n = 0
    @State private var all = false
    @State private var pulse = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        let list = all ? shops : Array(shops.prefix(12))
        let done = n > list.count
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().stroke(pinkLine, lineWidth: 4)
                    Circle().trim(from: 0, to: list.isEmpty ? 1 : CGFloat(min(n, list.count)) / CGFloat(list.count)).stroke(okGreen, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90))
                }.frame(width: 44, height: 44).animation(.linear(duration: 0.15), value: n)
                VStack(alignment: .leading, spacing: 4) {
                    Text(done ? "🏆 Lowest price in Lebanon" : "Checking \(min(n, list.count))/\(list.count)…").font(.headline)
                    HStack(spacing: 6) {
                        HStack(spacing: 4) {
                            Circle().fill(.white).frame(width: 6, height: 6).opacity(pulse ? 0.3 : 1)
                            Text("LIVE").font(.system(size: 10, weight: .black))
                        }.foregroundStyle(.white).padding(.horizontal, 6).padding(.vertical, 2).background(Color(hex: "#d92d20"), in: Capsule())
                        Text("price watch on \(shops.count) online shops").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            FlowChips(items: list, ticked: n)
            if !all && shops.count > 12 {
                Button("+\(shops.count - 12) more") { all = true }.font(.caption.bold()).foregroundStyle(plum)
            }
            if done {
                Text("✓ No online shop in Lebanon beats our price, guaranteed.").font(.footnote.bold()).foregroundStyle(.white)
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading).background(okGreen, in: RoundedRectangle(cornerRadius: 10))
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.45), value: done)
        .task(id: list.count) {
            withAnimation(.easeInOut(duration: 0.8).repeatForever()) { pulse = true }
            if reduceMotion { n = list.count + 1; return }
            n = 0
            for i in 1...(list.count + 1) { try? await Task.sleep(for: .milliseconds(110)); n = i }
        }
    }
}

/// Shop names as wrapping chips; the first `ticked` turn green with a ✓.
struct FlowChips: View {
    let items: [String]; let ticked: Int
    var body: some View {
        WrapLayout(spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, name in
                HStack(spacing: 3) {
                    Text(i < ticked ? "✓" : "•").font(.caption2.bold())
                    Text(name).font(.caption2.weight(.medium))
                }
                .foregroundStyle(i < ticked ? okGreen : .secondary)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(i < ticked ? okSoft : .white, in: Capsule())
                .overlay(Capsule().stroke(i < ticked ? Color(hex: "#bfe3d2") : pinkLine))
                .animation(.easeOut(duration: 0.25), value: ticked)
            }
        }
    }
}

/// Simple wrapping layout for chips.
struct WrapLayout: Layout {
    var spacing: CGFloat = 6
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x + z.width > w, x > 0 { x = 0; y += row + spacing; row = 0 }
            x += z.width + spacing; row = max(row, z.height)
        }
        return CGSize(width: w, height: y + row)
    }
    func placeSubviews(in b: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = b.minX, y = b.minY, row: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x + z.width > b.maxX, x > b.minX { x = b.minX; y += row + spacing; row = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(z))
            x += z.width + spacing; row = max(row, z.height)
        }
    }
}

/// Checkout: SuperPrime — already a member, free trial, or join for a month (paid with the order).
struct PrimeChoice: View {
    let cfg: Config.Prime; let q: Quote.PrimeQ?
    @Binding var choice: String
    var body: some View {
        let member = q?.status == "trial" || q?.status == "active"
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "crown.fill").foregroundStyle(.white).frame(width: 30, height: 30).background(LinearGradient(colors: [mark, plum], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
                VStack(alignment: .leading, spacing: 1) {
                    Text(cfg.name).font(.headline)
                    Text("Free delivery on every order from \(money(cfg.freeMin))\(cfg.unlimitedSuperPrice ? " · SuperPrice with no daily limit" : "")").font(.caption).foregroundStyle(.secondary)
                }
            }
            if member {
                Label("You're a \(cfg.name) member\(untilText)", systemImage: "checkmark.seal.fill").font(.footnote.bold()).foregroundStyle(okGreen)
            } else {
                let trialOk = q?.trialOk ?? cfg.promoLive
                if trialOk && cfg.trialMonths > 0 {
                    option("trial", "Free for \(cfg.trialMonths) months", cfg.promoLive ? "Free trial, no minimum order" : "Free trial with this order")
                }
                option("join", "Join for \(money(cfg.monthlyPrice)) / month", "Added to this order; renew any time at checkout")
                option("", "No thanks", nil)
                if !trialOk && cfg.trialMonths > 0 && !(q?.trialUsed ?? false) {
                    Text("Free \(cfg.trialMonths)-month trial with a first order of \(money(cfg.trialMinOrder)) or more.").font(.caption2).foregroundStyle(.secondary)
                }
                if q?.known != true { Text("Enter your mobile above so we can check if you're already a member.").font(.caption2).foregroundStyle(.secondary) }
            }
        }
    }
    var untilText: String {
        guard let u = q?.until, let d = ISO8601DateFormatter.full.date(from: u) ?? ISO8601DateFormatter().date(from: u) else { return "" }
        return " until \(d.formatted(.dateTime.day().month(.abbreviated)))"
    }
    func option(_ id: String, _ title: String, _ sub: String?) -> some View {
        Button { choice = id; UIImpactFeedbackGenerator(style: .light).impactOccurred() } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: choice == id ? "largecircle.fill.circle" : "circle").foregroundStyle(choice == id ? plum : .secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink)
                    if let s = sub { Text(s).font(.caption).foregroundStyle(.secondary) }
                }
                Spacer()
            }.contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

extension ISO8601DateFormatter {
    static let full: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}
