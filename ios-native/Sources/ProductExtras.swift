import SwiftUI
import UIKit

// Product page extras that match the website: expert reviews, rotating tips, back-in-stock alerts.

struct PressReview: Codable, Identifiable, Hashable {
    var id: String { url }
    let site: String; let title: String; let url: String; let summary: String
    var verdict: String? = nil; var date: String? = nil; var liked: [String]? = nil; var watch: [String]? = nil
    var rating: String? = nil; var author: String? = nil; var domain: String? = nil; var long: String? = nil
}
private struct PressList: Codable { let reviews: [PressReview] }
private struct TipList: Codable { let tips: [String] }

extension API {
    static func press(_ slug: String) async -> [PressReview] { (try? await get("/api/products/press/?slug=\(slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? slug)", as: PressList.self))?.reviews ?? [] }
    static func tips(_ slug: String) async -> [String] { (try? await get("/api/products/tips/?slug=\(slug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? slug)", as: TipList.self))?.tips ?? [] }
}

/// Opens WhatsApp with a message; falls back to the share sheet if WhatsApp isn't installed.
func shareOnWhatsApp(_ text: String) {
    let enc = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    if let u = URL(string: "whatsapp://send?text=\(enc)"), UIApplication.shared.canOpenURL(u) { UIApplication.shared.open(u) }
    else if let u = URL(string: "https://wa.me/?text=\(enc)") { UIApplication.shared.open(u) }
}

/// Share menu: WhatsApp, Copy, or the system sheet.
struct ShareMenu: View {
    let text: String
    var label: String = "Share"
    @State private var copied = false
    var body: some View {
        Menu {
            Button { shareOnWhatsApp(text) } label: { Label("WhatsApp", systemImage: "message") }
            Button { UIPasteboard.general.string = text; copied = true; DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false } } label: { Label("Copy", systemImage: "doc.on.doc") }
            ShareLink(item: text) { Label("More…", systemImage: "square.and.arrow.up") }
        } label: {
            Label(copied ? "Copied" : label, systemImage: copied ? "checkmark" : "square.and.arrow.up")
                .font(.caption.bold()).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 5)
                .background(LinearGradient(colors: [Color(hex: "#ec4899"), Color(hex: "#f97316")], startPoint: .leading, endPoint: .trailing), in: Capsule())
        }
    }
}

/// Expert reviews from tier-1 publications, collapsible; each opens in a sheet.
struct PressSection: View {
    let slug: String; let productName: String
    @State private var reviews: [PressReview] = []
    @State private var open = false
    @State private var showing: PressReview?
    var body: some View {
        Group {
            if !reviews.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Button { withAnimation { open.toggle() } } label: {
                        HStack {
                            Image(systemName: "newspaper.fill").foregroundStyle(Color.rose)
                            Text("Expert reviews (\(reviews.count))").font(.headline).foregroundStyle(Color.ink)
                            Spacer(); Image(systemName: "chevron.down").rotationEffect(.degrees(open ? 180 : 0)).foregroundStyle(.secondary)
                        }.contentShape(Rectangle())
                    }.buttonStyle(.plain)
                    if open {
                        ForEach(Array(reviews.enumerated()), id: \.offset) { _, r in
                            Button { showing = r } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.site).font(.caption.bold()).foregroundStyle(Color.rose)
                                    Text(r.title).font(.subheadline).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                                    Text(r.summary).font(.caption).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.leading)
                                }.frame(maxWidth: .infinity, alignment: .leading).padding(10).background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                .padding(14).background(Color(hex: "#f6f1f3"), in: RoundedRectangle(cornerRadius: 20))
            }
        }
        .task(id: slug) { reviews = await API.press(slug) }
        .sheet(item: $showing) { r in PressSheet(r: r, productName: productName) }
    }
}

struct PressSheet: View {
    let r: PressReview; let productName: String
    @State private var full = false
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(r.site).font(.caption.bold()).foregroundStyle(Color.rose)
                    Text(r.title).font(.display(20))
                    Text([r.author.map { "By \($0)" }, r.domain ?? URL(string: r.url)?.host, r.date].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                    if let v = r.verdict, !v.isEmpty { Text(v).font(.subheadline.bold()).padding(10).frame(maxWidth: .infinity, alignment: .leading).background(Color(hex: "#fdeef3"), in: RoundedRectangle(cornerRadius: 12)) }
                    Picker("", selection: $full) { Text("Short").tag(false); Text("Full review").tag(true) }.pickerStyle(.segmented)
                    Text(full ? (r.long ?? r.summary) : r.summary).font(.body)
                    if full {
                        if let l = r.liked, !l.isEmpty { Text("What they liked").font(.subheadline.bold()); ForEach(l, id: \.self) { Text("✓ \($0)").font(.footnote) } }
                        if let w = r.watch, !w.isEmpty { Text("Worth knowing").font(.subheadline.bold()); ForEach(w, id: \.self) { Text("• \($0)").font(.footnote) } }
                    }
                    HStack {
                        ShareMenu(text: "\(r.site) on \(productName): \(r.summary)\n\(r.url)", label: "Share short")
                        ShareMenu(text: "\(r.site) on \(productName): \(r.long ?? r.summary)\n\(r.url)", label: "Share full")
                    }
                    if let u = URL(string: r.url) { Link("Read the original on \(r.site)", destination: u).font(.footnote) }
                    Text("Summary written by SuperYou from the published review.").font(.caption2).foregroundStyle(.secondary)
                }.padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { dismiss() } label: { Image(systemName: "xmark.circle.fill") }.accessibilityLabel("Close") } }
        }
    }
}

/// Rotating tips for this product, with previous / pause / next and share.
struct TipsCarousel: View {
    let slug: String; let productName: String
    @State private var tips: [String] = []
    @State private var i = 0
    @State private var paused = false
    private let timer = Timer.publish(every: 6, on: .main, in: .common).autoconnect()
    var body: some View {
        Group {
            if !tips.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("💡 Tip \(i + 1) of \(tips.count)").font(.caption.bold()).foregroundStyle(Color.rose)
                        Spacer()
                        ctl("chevron.left", "#f97316") { i = (i - 1 + tips.count) % tips.count }
                        ctl(paused ? "play.fill" : "pause.fill", "#ec4899") { paused.toggle() }
                        ctl("chevron.right", "#3b82f6") { i = (i + 1) % tips.count }
                    }
                    Text(tips[i]).font(.subheadline).id(i).transition(.opacity).frame(maxWidth: .infinity, alignment: .leading)
                    ShareMenu(text: "Tip for \(productName): \(tips[i])\nhttps://www.shopsuperyou.com/products/\(slug)/")
                }
                .padding(14).background(LinearGradient(colors: [Color(hex: "#fff7ed"), .white], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20))
                .onReceive(timer) { _ in if !paused { withAnimation { i = (i + 1) % tips.count } } }
            }
        }
        .task(id: slug) { tips = await API.tips(slug); i = 0 }
    }
    private func ctl(_ icon: String, _ hex: String, _ act: @escaping () -> Void) -> some View {
        Button(action: act) { Image(systemName: icon).font(.caption.bold()).foregroundStyle(.white).frame(width: 28, height: 28).background(Color(hex: hex), in: Circle()) }.buttonStyle(.plain)
    }
}

/// Sold out: notify me on WhatsApp or SMS when it's back.
struct StockAlertBox: View {
    let productId: String
    @AppStorage("sy.phone") private var phone = ""
    @State private var via = "whatsapp"
    @State private var state = ""
    @State private var err = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("SOLD OUT").font(.caption2.bold()).foregroundStyle(.white).padding(.horizontal, 6).padding(.vertical, 2).background(Color.secondary, in: Capsule()); Text("Notify me when it's back").font(.subheadline.bold()) }
            if state == "done" { Text("✓ We'll message you as soon as it's back in stock.").font(.footnote.bold()).foregroundStyle(Color(hex: "#046c4e")) }
            else {
                TextField("Mobile number", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber).padding(10).background(Color.white, in: RoundedRectangle(cornerRadius: 10))
                Picker("", selection: $via) { Text("WhatsApp").tag("whatsapp"); Text("SMS").tag("sms") }.pickerStyle(.segmented)
                if !err.isEmpty { Text(err).font(.caption).foregroundStyle(.red) }
                Button { Task { await send() } } label: { Text(state == "busy" ? "…" : "Notify me").font(.headline).frame(maxWidth: .infinity).padding(10) }
                    .buttonStyle(.borderedProminent).tint(Color.ink).disabled(phone.count < 6 || state == "busy")
            }
        }.padding(14).background(Color(hex: "#f6f1f3"), in: RoundedRectangle(cornerRadius: 20))
    }
    func send() async {
        state = "busy"; err = ""
        let r = try? await API.send("/api/stock-alert/", body: ["productId": productId, "phone": phone, "via": via])
        if r?.0 == 200 { state = "done" } else { state = ""; err = (r.flatMap { try? JSONSerialization.jsonObject(with: $0.1) as? [String: Any] }?["error"] as? String) ?? "Please try again" }
    }
}
