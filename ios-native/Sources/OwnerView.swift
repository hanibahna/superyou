import SwiftUI

// The Owner tab: sign in with the admin password (or a staff account) to see today's business.

struct OwnerOrder: Codable, Identifiable, Hashable {
    struct Line: Codable, Hashable { let name: String; let brand: String; let qty: Int; let lineTotal: Double }
    let id: String; let createdAt: String; let status: String; let total: Double; let payment: String
    let customer: String; let phone: String; let city: String; let address: String; let notes: String; let lines: [Line]
}
struct OwnerBooking: Codable, Identifiable, Hashable { let id: String; let title: String; let date: String; let time: String; let name: String; let phone: String; let status: String; let mode: String; let hostUrl: String }
struct OwnerSummary: Codable {
    struct Me: Codable { let name: String; let role: String }
    struct Tally: Codable { let orders: Int; let sales: Double }
    struct Subs: Codable { let active: Int; let total: Int }
    let me: Me; let today: Tally; let week: Tally; let toHandle: Int; let orders: [OwnerOrder]; let bookings: [OwnerBooking]; let subscriptions: Subs
}
private struct Me: Codable { let signedIn: Bool; let name: String?; let role: String? }

@MainActor
final class Owner: ObservableObject {
    @Published var signedIn = false
    @Published var summary: OwnerSummary?
    @Published var error: String?

    func check() async {
        signedIn = (try? await API.get("/api/app/v1/admin/me", as: Me.self))?.signedIn ?? false
        if signedIn { await refresh() }
    }
    func signIn(email: String, password: String) async {
        error = nil
        var body: [String: Any] = ["password": password]
        if !email.isEmpty { body["email"] = email }
        guard let (status, data) = try? await API.send("/api/app/v1/admin/login", body: body) else { error = "No connection."; return }
        if status == 200 { signedIn = true; await refresh() }
        else { error = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "Wrong password." }
    }
    func signOut() {
        HTTPCookieStorage.shared.cookies(for: API.base)?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
        signedIn = false; summary = nil
    }
    func refresh() async {
        do { summary = try await API.get("/api/app/v1/admin/summary", as: OwnerSummary.self); error = nil }
        catch APIError.status(401) { signedIn = false }
        catch { self.error = "Couldn't load. Pull to refresh." }
    }
    func setStatus(_ id: String, _ status: String) async -> Bool {
        guard let (code, _) = try? await API.send("/api/app/v1/admin/orders/\(id)", method: "PATCH", body: ["status": status]) else { return false }
        if code == 200 { await refresh(); return true }
        return false
    }
}

struct OwnerView: View {
    @StateObject private var owner = Owner()
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false

    var body: some View {
        Group {
            if owner.signedIn, let s = owner.summary { dashboard(s) }
            else if owner.signedIn { ProgressView() }
            else {
                Form {
                    SwiftUI.Section(footer: Text("Owner: leave email empty and use the admin password. Staff: your email and your own password.")) {
                        TextField("Staff email (optional)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).textContentType(.username)
                        SecureField("Password", text: $password).textContentType(.password)
                        if let e = owner.error { Text(e).foregroundStyle(Color.rose).font(.footnote) }
                        Button(busy ? "Signing in…" : "Sign in") { Task { busy = true; await owner.signIn(email: email, password: password); password = ""; busy = false } }.disabled(busy || password.isEmpty)
                    }
                }
            }
        }
        .navigationTitle("Owner")
        .task { await owner.check() }
    }

    @ViewBuilder private func dashboard(_ s: OwnerSummary) -> some View {
        List {
            SwiftUI.Section {
                HStack(spacing: 12) {
                    tile("Today", money(s.today.sales), "\(s.today.orders) orders")
                    tile("7 days", money(s.week.sales), "\(s.week.orders) orders")
                }
                HStack(spacing: 12) {
                    tile("To handle", "\(s.toHandle)", "orders")
                    tile("Subscriptions", "\(s.subscriptions.active)", "active")
                }
            }.listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)).listRowBackground(Color.clear)
            if !s.bookings.isEmpty {
                SwiftUI.Section("Upcoming calls & visits") {
                    ForEach(s.bookings) { b in
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(b.date) · \(b.time)  \(b.mode == "video" ? "📹" : "🏬")").font(.subheadline.bold())
                            Text("\(b.title): \(b.name), \(b.phone)").font(.footnote)
                            if b.mode == "video", let u = URL(string: b.hostUrl), !b.hostUrl.isEmpty { Link("Join as host", destination: u).font(.footnote.weight(.semibold)) }
                        }
                    }
                }
            }
            SwiftUI.Section("Latest orders") {
                ForEach(s.orders) { o in NavigationLink { OwnerOrderView(order: o, owner: owner) } label: { orderRow(o) } }
            }
            SwiftUI.Section {
                Link("Open the full admin (website)", destination: URL(string: "https://www.shopsuperyou.com/admin/")!)
                Button("Sign out", role: .destructive) { owner.signOut() }
            } footer: { Text("Signed in as \(s.me.name)") }
        }
        .refreshable { await owner.refresh() }
    }

    private func tile(_ t: String, _ v: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(t).font(.caption).foregroundStyle(.secondary)
            Text(v).font(.title2.bold())
            Text(sub).font(.caption2).foregroundStyle(.secondary)
        }.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(Color.white, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: "#eee5ea")))
    }
    private func orderRow(_ o: OwnerOrder) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack { Text(o.id).font(.subheadline.bold()); Spacer(); Text(money(o.total)).font(.subheadline) }
            Text("\(o.customer) · \(o.city)").font(.caption)
            Text(statusLabel(o.status)).font(.caption.weight(.semibold)).foregroundStyle(Color.rose)
        }
    }
}

func statusLabel(_ s: String) -> String { s.replacingOccurrences(of: "_", with: " ").capitalized }

struct OwnerOrderView: View {
    let order: OwnerOrder
    @ObservedObject var owner: Owner
    @State private var msg: String?
    private let flow = ["confirmed", "packed", "shipped", "delivered", "cancelled", "returned"]
    var body: some View {
        List {
            SwiftUI.Section("Customer") {
                Text(order.customer).font(.headline)
                Link(order.phone, destination: URL(string: "tel:\(order.phone.filter { $0.isNumber || $0 == "+" })")!)
                if let u = URL(string: "https://wa.me/\(order.phone.filter { $0.isNumber })") { Link("WhatsApp the customer", destination: u) }
                Text("\(order.city), \(order.address)").font(.footnote)
                if !order.notes.isEmpty { Text("Notes: \(order.notes)").font(.footnote).foregroundStyle(.secondary) }
            }
            SwiftUI.Section("Items") {
                ForEach(order.lines, id: \.self) { l in HStack { Text("\(l.qty)× \(l.brand) \(l.name)").font(.footnote); Spacer(); Text(money(l.lineTotal)).font(.footnote) } }
                HStack { Text("Total").bold(); Spacer(); Text(money(order.total)).bold() }
                Text("Payment: \(order.payment == "cod" ? "cash on delivery" : order.payment)").font(.caption).foregroundStyle(.secondary)
            }
            SwiftUI.Section("Status: \(statusLabel(order.status))") {
                ForEach(flow, id: \.self) { s in
                    Button(statusLabel(s)) { Task { msg = await owner.setStatus(order.id, s) ? "Updated to \(statusLabel(s)). The customer gets the usual WhatsApp update." : "Couldn't update. Your account may not allow it." } }
                        .disabled(s == order.status)
                }
                if let m = msg { Text(m).font(.footnote) }
            }
        }.navigationTitle(order.id)
    }
}
