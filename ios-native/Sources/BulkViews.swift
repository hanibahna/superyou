import SwiftUI

/// Product page: 1, 2 or 3 items with the bulk price live; tapping one sets the quantity added to the bag.
struct BulkOffer: View {
    let cfg: Config.BulkCfg; let price: Double
    @Binding var qty: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            (Text("📦 Bulk buy: ").bold() + Text("\(Int(cfg.pct))% off from 2 items").bold().foregroundColor(Color(hex: "#9b2c50"))).font(.subheadline)
            HStack(spacing: 8) {
                ForEach(1...max(1, cfg.maxUnits), id: \.self) { n in
                    let full = price * Double(n)
                    let off = n >= 2 ? (full * cfg.pct / 100 * 100).rounded() / 100 : 0
                    Button { qty = n; UISelectionFeedbackGenerator().selectionChanged() } label: {
                        VStack(spacing: 2) {
                            Text("\(n) \(n == 1 ? "item" : "items")").font(.caption).foregroundStyle(.secondary)
                            Text(money(full - off)).font(.subheadline.bold()).foregroundStyle(.primary)
                            if off > 0 { Text("Save \(money(off))").font(.caption2.bold()).foregroundStyle(.white).padding(.horizontal, 6).padding(.vertical, 1).background(Capsule().fill(Color(hex: "#046c4e"))) }
                            else { Text(" ").font(.caption2) }
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(qty == n ? Color(hex: "#9b2c50") : Color.clear, lineWidth: 2))
                    }.buttonStyle(.plain)
                }
            }
            Text("Same saving as Subscribe & save, without subscribing: paid now, on this order. Up to \(cfg.maxUnits) per product a day.").font(.caption2).foregroundStyle(.secondary)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [Color(hex: "#fff5f8"), .white], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "#f3c4d2")))
    }
}

/// Bag line: the live bulk saving, or how to get it.
struct BulkNote: View {
    let cfg: Config.BulkCfg; let line: Quote.BulkLine?; let qty: Int
    var body: some View {
        if let b = line, b.saving > 0 {
            Text("📦 \(b.business == nil ? "Bulk buy" : "Business price") −\(Int(b.pct))% on \(b.units) · you save \(money(b.saving))").font(.caption2.bold()).foregroundStyle(Color(hex: "#046c4e"))
                .padding(.horizontal, 6).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: 6).fill(Color(hex: "#e6f4ee")))
        } else if let b = line, b.left == 0 {
            Text("Bulk discount already used today for this product").font(.caption2).foregroundStyle(.secondary)
        } else if qty == 1 {
            Text("📦 Add 1 more and save \(Int(cfg.pct))% (bulk buy, paid now)").font(.caption2.bold()).foregroundStyle(Color(hex: "#9b2c50"))
        }
    }
}
