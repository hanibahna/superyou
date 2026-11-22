import SwiftUI

extension Color {
    static let ink = Color(red: 0.078, green: 0.071, blue: 0.078)
    static let rose = Color(red: 0.753, green: 0.345, blue: 0.478)
    static let blush = Color(red: 0.953, green: 0.890, blue: 0.918)
    static let paper = Color(red: 0.980, green: 0.969, blue: 0.973)
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
