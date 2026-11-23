import SwiftUI

/// Partner-clinic treatment (mock-up names and prices for now).
struct Treatment: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let category: String
    let what: String
    let routine: String
    let sessions: String
    let downtime: String
    let minutes: Int
    let priceFrom: Double
}
struct ClinicInfo: Codable { let partner: String; let mock: Bool; let note: String?; let items: [Treatment]? }
private struct ClinicReply: Codable { let ok: Bool?; let error: String? }

/// All clinic treatments, by category, each bookable (date confirmed by our team on WhatsApp).
struct ClinicView: View {
    @State private var info: ClinicInfo?
    var body: some View {
        List {
            SwiftUI.Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your home routine prepares and maintains your skin; clinic treatments do what creams can't. Start with a dermatologist consultation, then follow the plan.").font(.footnote)
                    if let i = info { PartnerTag(partner: i.partner, mock: i.mock) }
                }
            }
            let items = info?.items ?? []
            ForEach(Array(Set(items.map(\.category))).sorted { a, b in (items.firstIndex { $0.category == a } ?? 0) < (items.firstIndex { $0.category == b } ?? 0) }, id: \.self) { cat in
                SwiftUI.Section(cat) {
                    ForEach(items.filter { $0.category == cat }) { t in
                        NavigationLink { TreatmentBookingView(treatment: t, partner: info?.partner ?? "DermaPro") } label: { TreatmentRow(t: t) }
                    }
                }
            }
            if let n = info?.note { SwiftUI.Section { Text(n).font(.caption).foregroundStyle(.secondary) } }
        }
        .navigationTitle("Clinic treatments")
        .task { info = try? await API.get("/api/app/v1/clinic", as: ClinicInfo.self) }
    }
}

struct PartnerTag: View {
    let partner: String; let mock: Bool
    var body: some View {
        HStack(spacing: 6) {
            Text(partner).font(.caption.bold())
            if mock { Text("MOCK-UP").font(.system(size: 9, weight: .bold)).padding(.horizontal, 6).padding(.vertical, 2).background(Color(hex: "#fde68a"), in: Capsule()) }
            Text("Partner clinic, Beirut").font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct TreatmentRow: View {
    let t: Treatment
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) { Text(t.name).font(.headline); Spacer(); Text("from \(money(t.priceFrom))").font(.footnote.bold()) }
            Text(t.what).font(.footnote)
            Text("With your routine: \(t.routine)").font(.caption).foregroundStyle(.secondary)
            Text("\(t.sessions) · Downtime: \(t.downtime)").font(.caption2).foregroundStyle(Color.rose)
        }.padding(.vertical, 4)
    }
}

/// Request a preferred date; nothing to pay now, our team confirms on WhatsApp.
struct TreatmentBookingView: View {
    let treatment: Treatment
    let partner: String
    @AppStorage("sy.first") private var first = ""
    @AppStorage("sy.phone") private var phone = ""
    @State private var date = Date().addingTimeInterval(86400)
    @State private var notes = ""
    @State private var busy = false
    @State private var error: String?
    @State private var done = false
    @State private var store: Config.Store?

    var body: some View {
        Form {
            SwiftUI.Section { TreatmentRow(t: treatment); PartnerTag(partner: partner, mock: true) }
            if let s = store, !done {
                SwiftUI.Section("Book now") {
                    let text = "Hello SuperYou, I'd like to book \(treatment.name) at \(partner).".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                    if !s.whatsapp.isEmpty, let u = URL(string: "https://wa.me/\(s.whatsapp)?text=\(text)") { Link(destination: u) { Label("Book on WhatsApp", systemImage: "message.fill") } }
                    if !s.phone.isEmpty, let u = URL(string: "tel:\(s.phone.replacingOccurrences(of: " ", with: ""))") { Link(destination: u) { Label("Call us", systemImage: "phone.fill") } }
                }
            }
            if done {
                SwiftUI.Section { Label("Request received. Our team will message you on WhatsApp to confirm the date and time. Nothing to pay now.", systemImage: "checkmark.circle.fill").foregroundStyle(Color.greenShip) }
            } else {
                SwiftUI.Section("Or pick a date") {
                    DatePicker("Day", selection: $date, in: Date().addingTimeInterval(86400)..., displayedComponents: .date)
                    TextField("Notes: preferred time, questions", text: $notes, axis: .vertical)
                }
                SwiftUI.Section("You") {
                    TextField("Your name", text: $first).textContentType(.name)
                    TextField("WhatsApp number", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                }
                if let e = error { Text(e).foregroundStyle(.red) }
                Button { Task { await send() } } label: { Text(busy ? "Sending…" : "Request this date").frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent).tint(Color.ink).disabled(busy || first.count < 2 || phone.count < 6)
                Text("Your date is confirmed by our team on WhatsApp. Prices are indicative and confirmed by the clinic after your consultation.").font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Book treatment")
        .task { store = await API.sharedConfig()?.store }
    }

    private func send() async {
        busy = true; error = nil
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        do {
            let (status, data) = try await API.send("/api/app/v1/bookings", body: ["kind": "clinic", "refId": treatment.id, "date": f.string(from: date), "name": first, "phone": phone, "notes": notes])
            let r = try? JSONDecoder().decode(ClinicReply.self, from: data)
            if status == 200 { done = true } else { error = r?.error ?? "Please try again." }
        } catch { self.error = "No connection. Please try again." }
        busy = false
    }
}

/// Step 2 of the SuperRoutine, shown under the routine in SuperScan results.
struct AfterRoutineSection: View {
    let items: [Treatment]
    let partner: String
    let mock: Bool
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("STEP 2 OF YOUR SUPERROUTINE").font(.caption2.bold()).foregroundStyle(Color.rose)
                Text("After your routine: clinic treatments").font(.display(20))
                Text("Use your home routine for 4–6 weeks first: it prepares your skin. Then these treatments go further than creams can. Our partner dermatologist confirms what suits you.").font(.footnote).foregroundStyle(.secondary)
                PartnerTag(partner: partner, mock: mock)
                ForEach(Array(items.enumerated()), id: \.element.id) { i, t in
                    NavigationLink { TreatmentBookingView(treatment: t, partner: partner) } label: {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(i + 1). \(t.name)").font(.headline)
                                Text(t.what).font(.footnote)
                                Text("With your routine: \(t.routine)").font(.caption).foregroundStyle(.secondary)
                                Text("from \(money(t.priceFrom)) · Book").font(.footnote.bold()).foregroundStyle(Color.rose)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }.padding().background(Color.white, in: RoundedRectangle(cornerRadius: 14))
                    }.buttonStyle(.plain)
                }
                NavigationLink { ClinicView() } label: { Text("All clinic treatments").font(.footnote.bold()).underline() }
                Text("Dates are confirmed by our team on WhatsApp. Prices are indicative (mock-up).").font(.caption2).foregroundStyle(.secondary)
            }.padding().background(Color(hex: "#fdf6f8"), in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.rose.opacity(0.3), lineWidth: 2))
        }
    }
}
