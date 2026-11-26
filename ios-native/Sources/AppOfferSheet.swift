import SwiftUI

/// Shown once on first launch: the app's welcome offer. Nothing to type: the discount is applied
/// automatically at checkout on the first order placed in the app.
struct AppOfferSheet: View {
    let offer: Config.AppOffer
    let done: () -> Void
    var body: some View {
        VStack(spacing: 16) {
            Text("🎉").font(.system(size: 48))
            Text("Welcome to the SuperYou app").font(.display(24)).multilineTextAlignment(.center)
            VStack(alignment: .leading, spacing: 10) {
                if offer.firstPct > 0 {
                    Label("\(Int(offer.firstPct))% off your first order in the app, applied automatically at checkout", systemImage: "tag.fill")
                }
                if offer.doublePoints {
                    Label("Double SuperYou Club points on every app order", systemImage: "star.fill")
                }
            }
            .font(.subheadline).frame(maxWidth: .infinity, alignment: .leading)
            .padding(14).background(Color(hex: "#fdeef3"), in: RoundedRectangle(cornerRadius: 16))
            Text("No code needed. Items already on sale and SuperPrice items keep their own price.").font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Button(action: done) { Text("Start shopping").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6) }
                .buttonStyle(.borderedProminent).tint(Color.ink)
        }
        .padding(24)
    }
}
