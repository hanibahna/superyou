import SwiftUI

struct AccountView: View {
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.lastOrder") private var order = ""
    @State private var account: Account?
    @State private var error: String?
    @State private var busy = false
    @State private var confirmDelete = false
    @State private var party = 0
    @AppStorage("sy.ownerMode") private var ownerMode = false
    @State private var ownerTaps = 0
    @AppStorage("sy.myref") private var referral: String?

    var body: some View {
        NavigationStack {
            Form {
                if let a = account {
                    if let m = a.member {
                        Section("SuperYou Club") {
                            Text("\(m.tier) member · \(m.name)").font(.headline)
                            LineRow("Points", "\(m.points)")
                        }
                    }
                    if let g = a.game { GameSections(game: g, party: $party) }
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
                Section("More") {
                    NavigationLink { WishlistView() } label: { Label("Wishlist", systemImage: "heart") }
                    NavigationLink { AdvisorView() } label: { Label("Ask our AI advisor", systemImage: "sparkles") }
                    NavigationLink { ServicesView() } label: { Label("Book a pharmacist video call", systemImage: "video") }
                    NavigationLink { ClinicView() } label: { Label("Clinic treatments", systemImage: "cross.case") }
                    if account != nil { NavigationLink { MyScansView(phone: phone, order: order) } label: { Label("My SuperScans", systemImage: "faceid") } }
                    if let r = referral, !r.isEmpty {
                        ShareLink(item: URL(string: "https://www.shopsuperyou.com/?ref=\(r)")!, message: Text("Shop original beauty and pharmacy at SuperYou with my link:")) { Label("Invite friends (your code \(r))", systemImage: "gift") }
                    }
                }
                if ownerMode {
                    Section("Business") {
                        NavigationLink { OwnerView() } label: { Label("Owner sign-in", systemImage: "lock.shield") }
                    }
                }
                Section {
                    Link(destination: URL(string: "https://wa.me/96170777608")!) { Label("Ask a pharmacist on WhatsApp", systemImage: "message") }
                    Link(destination: URL(string: "https://www.shopsuperyou.com/club/")!) { Label("Join SuperYou Club", systemImage: "star") }
                    Link(destination: URL(string: "https://www.shopsuperyou.com/pages/privacy-policy/")!) { Label("Privacy policy", systemImage: "lock") }
                } header: { Text("Help") } footer: {
                    // Owner sign-in stays out of customers' way: tap the version line 7 times to show it.
                    Text("SuperYou \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                        .onTapGesture { ownerTaps += 1; if ownerTaps >= 7 { ownerMode = true } }
                }
            }
            .navigationTitle("Account")
            .overlay { Confetti(fire: $party) }
            .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { await deleteAccount() } }
            } message: { Text("This removes your Club points, saved addresses and WhatsApp updates. Past orders stay on record for accounting.") }
        }
    }

    func load() async {
        busy = true; error = nil; defer { busy = false }
        let p = phone.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let o = order.uppercased().addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        do { account = try await API.get("/api/app/v1/club?phone=\(p)&order=\(o)", as: Account.self); if let r = account?.member?.ref, !r.isEmpty { referral = r } }
        catch { self.error = "We couldn't match that phone number and order number." }
    }

    func deleteAccount() async {
        _ = try? await API.post("/api/app/v1/account-delete", body: ["phone": phone, "order": order.uppercased(), "confirm": true], as: [String: Bool].self)
        account = nil; order = ""
    }
}

private struct ScanRow: Codable, Identifiable { let id: String; let link: String; let createdAt: String; let skinType: String?; let concerns: [String] }
private struct ScanList: Codable { let scans: [ScanRow] }

struct MyScansView: View {
    let phone: String; let order: String
    @State private var scans: [ScanRow]?
    var body: some View {
        List {
            if let s = scans {
                if s.isEmpty { Text("No scans yet. Open the SuperScan tab to take one.").foregroundStyle(.secondary) }
                ForEach(s) { x in
                    Link(destination: URL(string: API.base.absoluteString + x.link)!) {
                        VStack(alignment: .leading) {
                            Text("\(x.skinType ?? "") skin").font(.headline)
                            Text(x.concerns.joined(separator: " · ")).font(.footnote).foregroundStyle(.secondary)
                            Text(String(x.createdAt.prefix(10))).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            } else { ProgressView() }
        }
        .navigationTitle("My SuperScans")
        .task {
            let p = phone.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            let o = order.uppercased().addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
            scans = (try? await API.get("/api/app/v1/skin-scan/history?phone=\(p)&order=\(o)", as: ScanList.self))?.scans ?? []
        }
    }
}


/// Progress rings, badges, review quest and referral race (same engine as the website's account page).
struct GameSections: View {
    let game: GameState
    @Binding var party: Int
    static let icons: [String: String] = ["bag": "bag.fill", "scan": "faceid", "layers": "square.stack.3d.up.fill", "star": "star.fill", "camera": "camera.fill", "gift": "gift.fill", "repeat": "arrow.triangle.2.circlepath", "crown": "crown.fill"]
    var body: some View {
        if !game.newlyEarned.isEmpty {
            Section { Label("New badge: \(game.newlyEarned.joined(separator: ", "))", systemImage: "rosette").font(.headline).foregroundStyle(Color.rose) }
                .onAppear { party += 1 }
        }
        Section("Progress") {
            HStack(spacing: 16) {
                Ring(value: Double(game.voucher.points) / Double(max(1, game.voucher.target)), title: "Next voucher", value2: "\(game.voucher.points)/\(game.voucher.target)", note: "\(money(game.voucher.value)) at \(game.voucher.target)")
                Ring(value: game.tier.progress, title: game.tier.next.map { "Next: \($0)" } ?? "Top tier", value2: game.tier.name, note: game.tier.next != nil ? "\(money(game.tier.toNext)) to go" : "Thank you!")
            }.padding(.vertical, 6)
        }
        Section("My badges · \(game.badges.filter(\.earned).count) of \(game.badges.count)") {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 14) {
                ForEach(game.badges) { b in
                    VStack(spacing: 4) {
                        Image(systemName: Self.icons[b.icon] ?? "sparkles").font(.system(size: 20))
                            .foregroundStyle(b.earned ? Color.white : Color.ink.opacity(0.35))
                            .frame(width: 50, height: 50).background(b.earned ? Color.rose : Color.ink.opacity(0.06), in: Circle())
                        Text(b.name).font(.caption2.weight(.semibold)).multilineTextAlignment(.center).lineLimit(2)
                        if !b.earned && b.points > 0 { Text("+\(b.points)").font(.caption2).foregroundStyle(.secondary) }
                    }
                }
            }.padding(.vertical, 6)
        }
        if let q = game.quest {
            Section("Quest: review \(q.target) products you bought") {
                ProgressView(value: Double(q.done), total: Double(q.target)).tint(Color.rose)
                Text(q.complete ? "Done! +\(q.points) points added." : "\(q.done) of \(q.target) · +\(q.points) points when complete").font(.footnote).foregroundStyle(.secondary)
            }
        }
        if let r = game.race {
            Section("Referral race · \(r.friends) friend\(r.friends == 1 ? "" : "s")") {
                HStack(spacing: 8) {
                    ForEach(r.steps, id: \.self) { s in
                        VStack { Text("\(s.friends)").font(.display(20)); Text("+\(s.points)").font(.caption2) }
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(s.reached ? Color.rose : Color.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(s.reached ? Color.white : Color.ink)
                    }
                }
            }
        }
    }
}

struct Ring: View {
    let value: Double; let title: String; let value2: String; let note: String
    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().stroke(Color.ink.opacity(0.08), lineWidth: 7)
                Circle().trim(from: 0, to: min(1, max(0, value))).stroke(Color.rose, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
            }.frame(width: 52, height: 52)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption2.weight(.bold)).foregroundStyle(Color.rose)
                Text(value2).font(.subheadline.bold()).lineLimit(1)
                Text(note).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
