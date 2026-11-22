import SwiftUI

struct AccountView: View {
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.lastOrder") private var order = ""
    @State private var account: Account?
    @State private var error: String?
    @State private var busy = false
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                if let a = account {
                    if let m = a.member {
                        Section("SuperYou Club") {
                            Text("\(m.tier) member · \(m.name)").font(.headline)
                            Row("Points", "\(m.points)")
                        }
                    }
                    Section("Your orders") {
                        ForEach(a.orders) { o in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack { Text(o.id).font(.subheadline.bold()); Spacer(); Text(money(o.total)).font(.subheadline) }
                                Text(o.status.replacingOccurrences(of: "_", with: " ").capitalized).font(.caption).foregroundStyle(Color.rose)
                                Text(o.lines.map { "\($0.qty)× \($0.name)" }.joined(separator: ", ")).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                    }
                    Section {
                        Button("Sign out") { account = nil }
                        Button("Delete my account", role: .destructive) { confirmDelete = true }
                    }
                } else {
                    Section(footer: Text("Use the phone number you ordered with and any one of your order numbers (it's in your WhatsApp confirmation).")) {
                        TextField("Phone number", text: $phone).keyboardType(.phonePad)
                        TextField("Order number (e.g. SUP-M3K2Q)", text: $order).textInputAutocapitalization(.characters)
                        if let e = error { Text(e).foregroundStyle(Color.rose).font(.footnote) }
                        Button(busy ? "Finding…" : "Find my account") { Task { await load() } }.disabled(busy || phone.isEmpty || order.isEmpty)
                    }
                }
                Section("Help") {
                    Link(destination: URL(string: "https://wa.me/96170777608")!) { Label("Ask a pharmacist on WhatsApp", systemImage: "message") }
                    Link(destination: URL(string: "https://www.shopsuperyou.com/club/")!) { Label("Join SuperYou Club", systemImage: "star") }
                    Link(destination: URL(string: "https://www.shopsuperyou.com/pages/privacy/")!) { Label("Privacy policy", systemImage: "lock") }
                }
            }
            .navigationTitle("Account")
            .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await deleteAccount() } }
            } message: { Text("This removes your Club points, saved addresses and WhatsApp updates. Past orders stay on record for accounting.") }
        }
    }

    func load() async {
        busy = true; error = nil; defer { busy = false }
        let p = phone.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let o = order.uppercased().addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        do { account = try await API.get("/api/club/?phone=\(p)&order=\(o)", as: Account.self) }
        catch { self.error = "We couldn't match that phone number and order number." }
    }

    func deleteAccount() async {
        _ = try? await API.post("/api/account/delete/", body: ["phone": phone, "order": order.uppercased(), "confirm": true], as: [String: Bool].self)
        account = nil; order = ""
    }
}
