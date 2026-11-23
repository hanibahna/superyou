import SwiftUI

private struct Slots: Codable { let slots: [String] }
private struct BookReply: Codable { struct B: Codable { let id: String; let title: String; let date: String; let time: String; let mode: String; let link: String }; let ok: Bool?; let booking: B?; let error: String? }

/// Book a free pharmacist video call or an in-store visit.
struct ServicesView: View {
    @State private var services: [Config.Service] = []
    var body: some View {
        List {
            if services.isEmpty { Text("No bookings are open right now.").foregroundStyle(.secondary) }
            ForEach(services) { s in
                NavigationLink { BookingView(service: s) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(s.title).font(.headline)
                        Text(s.description).font(.footnote).foregroundStyle(.secondary).lineLimit(3)
                        HStack(spacing: 10) {
                            Label("\(s.duration) min", systemImage: "clock")
                            Text(s.price == 0 ? "Free" : money(s.price))
                            if s.video != "no" { Label(s.video == "only" ? "Video call" : "Video or in store", systemImage: "video") }
                        }.font(.caption).foregroundStyle(Color.rose)
                    }.padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Book a call or visit")
        .task { services = await API.sharedConfig()?.services ?? [] }
    }
}

struct BookingView: View {
    let service: Config.Service
    @AppStorage("sy.first") private var first = ""
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.email") private var email = ""
    @State private var date = Date()
    @State private var slots: [String] = []
    @State private var time = ""
    @State private var video = true
    @State private var busy = false
    @State private var error: String?
    @State private var done: String?
    @State private var callLink: URL?

    var body: some View {
        Form {
            if let d = done {
                SwiftUI.Section {
                    Label(d, systemImage: "checkmark.circle.fill").foregroundStyle(Color.greenShip)
                    if let l = callLink { Link("Open my call link", destination: l) }
                }
            } else {
                SwiftUI.Section("When") {
                    DatePicker("Day", selection: $date, in: Date()..., displayedComponents: .date)
                    if slots.isEmpty { Text("No free times that day. Try another day.").font(.footnote).foregroundStyle(.secondary) }
                    else {
                        Picker("Time", selection: $time) { Text("Choose").tag(""); ForEach(slots, id: \.self) { Text($0).tag($0) } }
                    }
                    if service.video == "yes" { Toggle("Video call (from home)", isOn: $video) }
                }
                SwiftUI.Section("You") {
                    TextField("Your name", text: $first)
                    TextField("WhatsApp number", text: $phone).keyboardType(.phonePad)
                    TextField("Email (optional)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                }
                if let e = error { Text(e).foregroundStyle(Color.rose).font(.footnote) }
                Button(busy ? "Booking…" : "Book") { Task { await book() } }.disabled(busy || time.isEmpty || first.count < 2 || phone.count < 6)
            }
        }
        .navigationTitle(service.title).navigationBarTitleDisplayMode(.inline)
        .task(id: date) { await loadSlots() }
    }

    private var day: String { let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date) }

    func loadSlots() async {
        time = ""
        slots = (try? await API.get("/api/app/v1/availability?service=\(service.id)&date=\(day)", as: Slots.self))?.slots ?? []
    }
    func book() async {
        busy = true; error = nil; defer { busy = false }
        let mode = service.video == "only" ? "video" : (service.video == "yes" && video ? "video" : "store")
        let body: [String: Any] = ["kind": "service", "refId": service.id, "date": day, "time": time, "name": first, "phone": phone, "email": email, "mode": mode]
        guard let (_, data) = try? await API.send("/api/app/v1/bookings", body: body), let r = try? JSONDecoder().decode(BookReply.self, from: data) else { error = "We couldn't reach the shop."; return }
        if let b = r.booking {
            done = "Booked: \(b.title), \(b.date) at \(b.time). We'll confirm on WhatsApp."
            if !b.link.isEmpty { callLink = URL(string: API.base.absoluteString + b.link) }
        } else { error = r.error ?? "Please try another time." }
    }
}
