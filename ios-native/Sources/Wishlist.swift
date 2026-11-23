import SwiftUI

/// Saved products, kept on the phone.
@MainActor
final class Wishlist: ObservableObject {
    @Published var items: [Card] = [] { didSet { save() } }
    private let key = "sy.wishlist"

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let l = try? JSONDecoder().decode([Card].self, from: d) { items = l }
    }
    private func save() { if let d = try? JSONEncoder().encode(items) { UserDefaults.standard.set(d, forKey: key) } }

    func has(_ slug: String) -> Bool { items.contains { $0.slug == slug } }
    func toggle(_ c: Card) {
        if has(c.slug) { items.removeAll { $0.slug == c.slug } } else { items.insert(c, at: 0) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

struct WishlistView: View {
    @EnvironmentObject var wishlist: Wishlist
    var body: some View {
        Group {
            if wishlist.items.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "heart").font(.largeTitle).foregroundStyle(Color.rose)
                    Text("Tap the heart on any product to save it here.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                }.frame(maxWidth: .infinity, maxHeight: .infinity).padding(40)
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 16) {
                        ForEach(wishlist.items) { c in NavigationLink(value: c) { CardView(card: c) }.buttonStyle(.plain) }
                    }.padding()
                }
            }
        }
        .navigationTitle("Wishlist")
        .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
    }
}
