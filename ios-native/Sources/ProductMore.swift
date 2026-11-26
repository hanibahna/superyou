import SwiftUI

// Product page parts matching the website: customer reviews (read + write), "You may also like",
// recently viewed, quantity, delivery & returns, and full-screen photos with pinch-to-zoom.

// MARK: Quantity

struct QtyStepper: View {
    @Binding var qty: Int
    var body: some View {
        HStack(spacing: 0) {
            Text("Quantity").font(.subheadline.weight(.semibold))
            Spacer()
            HStack(spacing: 0) {
                Button { if qty > 1 { qty -= 1 } } label: { Image(systemName: "minus").frame(width: 44, height: 40) }.disabled(qty <= 1).accessibilityLabel("One less")
                Text("\(qty)").font(.headline).frame(minWidth: 32).accessibilityLabel("Quantity \(qty)")
                Button { if qty < 20 { qty += 1 } } label: { Image(systemName: "plus").frame(width: 44, height: 40) }.disabled(qty >= 20).accessibilityLabel("One more")
            }
            .foregroundStyle(Color.ink)
            .overlay(Capsule().stroke(Color(hex: "#eee5ea")))
        }
    }
}

// MARK: Photos

/// Tap a photo to open it full screen; pinch or double-tap to zoom, swipe between photos.
struct ZoomGallery: View {
    let images: [String]
    @State var index: Int
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.white.ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(images.enumerated()), id: \.offset) { i, u in ZoomableImage(url: u).tag(i) }
            }.tabViewStyle(.page(indexDisplayMode: images.count > 1 ? .always : .never)).indexViewStyle(.page(backgroundDisplayMode: .always))
            Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").font(.title).foregroundStyle(Color.ink.opacity(0.7)) }
                .padding().accessibilityLabel("Close")
        }
    }
}

private struct ZoomableImage: View {
    let url: String
    @State private var scale: CGFloat = 1
    @State private var last: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    var body: some View {
        RemoteImage(url: url)
            .scaleEffect(scale).offset(offset)
            .gesture(MagnificationGesture()
                .onChanged { scale = min(max(last * $0, 1), 5) }
                .onEnded { _ in last = scale; if scale <= 1 { withAnimation { offset = .zero; lastOffset = .zero } } })
            .simultaneousGesture(scale > 1 ? DragGesture()
                .onChanged { offset = CGSize(width: lastOffset.width + $0.translation.width, height: lastOffset.height + $0.translation.height) }
                .onEnded { _ in lastOffset = offset } : nil)
            .onTapGesture(count: 2) { withAnimation { if scale > 1 { scale = 1; last = 1; offset = .zero; lastOffset = .zero } else { scale = 2.5; last = 2.5 } } }
            .padding()
    }
}

// MARK: Carousels

/// A row of product cards ("You may also like", "Recently viewed").
struct CardCarousel: View {
    let title: String; let eyebrow: String?; let cards: [Card]
    var body: some View {
        if !cards.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    if let e = eyebrow { Text(e.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose) }
                    Text(title).font(.display(20))
                }.padding(.horizontal)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(cards) { c in
                            NavigationLink { ProductView(slug: c.slug) } label: { CardView(card: c).frame(width: 150) }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal)
                }
            }
        }
    }
}

/// Products opened lately (kept on the phone, newest first, up to 20).
final class RecentStore: ObservableObject {
    static let shared = RecentStore()
    @Published private(set) var items: [Card] = []
    private let key = "sy.recent"
    private init() { if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode([Card].self, from: d) { items = l } }
    func add(_ c: Card) {
        items.removeAll { $0.slug == c.slug }
        items.insert(c, at: 0)
        if items.count > 20 { items = Array(items.prefix(20)) }
        if let d = try? JSONEncoder().encode(items) { UserDefaults.standard.set(d, forKey: key) }
    }
}

struct RecentlyViewedRow: View {
    let except: String
    @ObservedObject private var store = RecentStore.shared
    var body: some View {
        CardCarousel(title: "Recently viewed", eyebrow: nil, cards: store.items.filter { $0.slug != except }.prefix(12).map { $0 })
    }
}

// MARK: Delivery & returns

struct DeliveryReturns: View {
    let variant: Variant
    @State private var cfg: Config?
    @State private var open = false
    var body: some View {
        DisclosureGroup(isExpanded: $open) {
            VStack(alignment: .leading, spacing: 8) {
                if variant.origin == "international" {
                    row("airplane", "Ships from \(variant.shipFrom) in \(variant.daysMin)–\(variant.daysMax) days. Shipping, customs and VAT are already in the price.")
                }
                if let t = cfg?.deliveryPolicy, !t.isEmpty { Text(t).font(.footnote).foregroundStyle(.secondary) }
                NavigationLink { SitePage(title: "Delivery", path: "/pages/delivery/") } label: { Text("Full delivery & returns policy").font(.footnote.weight(.semibold)) }
            }.padding(.top, 6)
        } label: { Text("Delivery & returns").font(.subheadline.bold()).foregroundStyle(Color.ink) }
        .task { cfg = await API.sharedConfig() }
    }
    private func row(_ icon: String, _ t: String) -> some View {
        Label { Text(t).font(.footnote).foregroundStyle(.secondary) } icon: { Image(systemName: icon).foregroundStyle(Color.rose) }
    }
}

// MARK: Reviews

struct ReviewsSection: View {
    let product: Product
    @State private var write = false
    @State private var showAll = false
    @State private var thanks: String?
    var body: some View {
        let list = product.reviews ?? []
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Customer reviews").font(.display(20))
                Spacer()
                Button("Write a review") { write = true }.font(.subheadline.weight(.semibold))
            }
            if let r = product.rating, product.reviewCount > 0 {
                HStack(spacing: 8) {
                    Text(String(format: "%.1f", r)).font(.display(28))
                    VStack(alignment: .leading, spacing: 2) {
                        StarsRow(value: r)
                        Text("\(product.reviewCount) review\(product.reviewCount == 1 ? "" : "s")").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            if let t = thanks { Text(t).font(.footnote.bold()).foregroundStyle(Color(hex: "#046c4e")) }
            if list.isEmpty {
                Text("No reviews yet. Bought it? Be the first to say how it worked for you.").font(.footnote).foregroundStyle(.secondary)
            } else {
                ForEach(showAll ? list : Array(list.prefix(3))) { r in ReviewRow(review: r); Divider() }
                if list.count > 3 && !showAll { Button("Show all \(list.count) reviews") { showAll = true }.font(.subheadline.weight(.semibold)) }
            }
        }
        .sheet(isPresented: $write) { WriteReview(slug: product.slug, name: "\(product.brand) \(product.name)") { thanks = $0 } }
    }
}

struct StarsRow: View {
    let value: Double
    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: Double(i) <= value ? "star.fill" : (Double(i) - 0.5 <= value ? "star.leadinghalf.filled" : "star"))
            }
        }.font(.caption).foregroundStyle(Color.rose).accessibilityLabel(String(format: "%.1f out of 5 stars", value))
    }
}

private struct ReviewRow: View {
    let review: Review
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                StarsRow(value: Double(review.rating))
                if review.verified { Label("Verified buyer", systemImage: "checkmark.seal.fill").font(.caption2.bold()).foregroundStyle(Color(hex: "#046c4e")) }
                Spacer()
                Text(String(review.createdAt.prefix(10))).font(.caption2).foregroundStyle(.secondary)
            }
            if !review.title.isEmpty { Text(review.title).font(.subheadline.bold()) }
            Text(review.body).font(.footnote)
            Text(review.name + (review.skinType.map { " · \($0) skin" } ?? "")).font(.caption).foregroundStyle(.secondary)
            if let rep = review.reply, !rep.isEmpty {
                Text("SuperYou pharmacist: \(rep)").font(.caption).padding(8).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: "#f6f1f3"), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

private struct WriteReview: View {
    let slug: String; let name: String
    let done: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.lastOrder") private var order = ""
    @AppStorage("sy.reviewName") private var who = ""
    @State private var rating = 0
    @State private var title = ""
    @State private var text = ""
    @State private var skin = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(name).font(.subheadline.bold())
                    HStack(spacing: 10) {
                        ForEach(1...5, id: \.self) { i in
                            Button { rating = i } label: { Image(systemName: i <= rating ? "star.fill" : "star").font(.title2).foregroundStyle(Color.rose) }
                                .buttonStyle(.plain).accessibilityLabel("\(i) star\(i == 1 ? "" : "s")")
                        }
                    }
                }
                Section("Your review") {
                    TextField("Title (optional)", text: $title)
                    TextField("How did it work for you?", text: $text, axis: .vertical).lineLimit(4...10)
                }
                Section {
                    TextField("Your first name", text: $who).textContentType(.givenName)
                    Picker("Skin type", selection: $skin) { Text("Prefer not to say").tag(""); ForEach(["Dry", "Oily", "Combination", "Normal", "Sensitive"], id: \.self) { Text($0).tag($0) } }
                } footer: {
                    Text(phone.isEmpty ? "Signed in under Account? Your review then shows as a verified buyer." : "Shows as a verified buyer if you got this product in a delivered order.")
                }
                if let e = error { Text(e).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Write a review").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(busy ? "Sending…" : "Send") { Task { await send() } }.disabled(busy || rating == 0 || text.count < 3 || who.isEmpty) }
            }
        }
    }
    func send() async {
        busy = true; defer { busy = false }
        var body: [String: Any] = ["slug": slug, "rating": rating, "title": title, "body": text, "name": who]
        if !skin.isEmpty { body["skinType"] = skin }
        if !phone.isEmpty, !order.isEmpty { body["phone"] = phone; body["order"] = order }
        do {
            let (code, data) = try await API.send("/api/app/v1/review", body: body)
            let r = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            if code == 200 {
                done((r?["status"] as? String) == "approved" ? "Thank you! Your review is live." : "Thank you! Your review will appear once our team checks it.")
                dismiss()
            } else { error = (r?["error"] as? String) ?? "Couldn't send. Please try again." }
        } catch { self.error = "Couldn't send. Please check your connection." }
    }
}
