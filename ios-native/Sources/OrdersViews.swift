import SwiftUI

// Order details with delivery tracking, and auto-replenish plans the shopper can manage (as on the website).

private let statusLabel: [String: String] = [
    "pending_cod": "Placed · pay at the door", "awaiting_payment": "Awaiting payment", "paid": "Paid", "confirmed": "Confirmed",
    "packed": "Packed", "shipped": "On its way", "delivered": "Delivered", "payment_failed": "Payment failed", "cancelled": "Cancelled", "returned": "Returned",
]
func orderStatusText(_ s: String) -> String { statusLabel[s] ?? s.replacingOccurrences(of: "_", with: " ").capitalized }

private func niceDate(_ iso: String, time: Bool = false) -> String {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? { let x = DateFormatter(); x.dateFormat = "yyyy-MM-dd"; return x.date(from: String(iso.prefix(10))) }()
    guard let d else { return iso }
    let o = DateFormatter(); o.dateStyle = .medium; o.timeStyle = time ? .short : .none
    return o.string(from: d)
}

struct OrderDetailView: View {
    let order: Order
    @State private var cfg: Config?
    private let steps = ["confirmed", "packed", "shipped", "delivered"]
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(orderStatusText(order.status)).font(.headline).foregroundStyle(Color.rose)
                    if let i = stepIndex {
                        HStack(spacing: 4) { ForEach(0..<steps.count, id: \.self) { k in Capsule().fill(k <= i ? Color.ink : Color(hex: "#eee5ea")).frame(height: 6) } }
                        HStack { ForEach(["Confirmed", "Packed", "On its way", "Delivered"], id: \.self) { Text($0).font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity) } }
                    }
                    Text("Placed \(niceDate(order.createdAt, time: true))").font(.caption).foregroundStyle(.secondary)
                }.padding(.vertical, 4)
            }
            if let s = order.shipment {
                Section("Delivery tracking") {
                    if let c = s.courierName, !c.isEmpty { LabeledContent("Courier", value: c) }
                    if let t = s.tracking, !t.isEmpty { LabeledContent("Tracking number") { Text(t).textSelection(.enabled) } }
                    ForEach(Array((s.events ?? []).enumerated()), id: \.offset) { i, e in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.text).font(.subheadline.weight(i == 0 ? .semibold : .regular))
                            Text(niceDate(e.at, time: true) + (e.place.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if let l = s.link, let u = URL(string: l), !l.isEmpty { Link(destination: u) { Label("Open courier tracking", systemImage: "shippingbox") } }
                }
            }
            Section("Items") {
                ForEach(Array(order.lines.enumerated()), id: \.offset) { _, l in
                    HStack(alignment: .top) { Text("\(l.qty)×").foregroundStyle(.secondary); Text(l.name).font(.subheadline); Spacer(); Text(money(l.lineTotal)).font(.subheadline) }
                }
            }
            Section {
                if let s = order.subtotal { LabeledContent("Subtotal", value: money(s)) }
                if let d = order.discount, d > 0 { LabeledContent("Discounts", value: "−\(money(d))") }
                if let d = order.delivery { LabeledContent("Delivery", value: d == 0 ? "Free" : money(d)) }
                LabeledContent("Total") { Text(money(order.total)).bold() }
            }
            Section {
                if let w = cfg?.store.whatsapp, let u = URL(string: "https://wa.me/\(w.filter(\.isNumber))?text=\("Hello, about my order \(order.id)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                    Link(destination: u) { Label("Ask about this order on WhatsApp", systemImage: "message") }
                }
            }
        }
        .navigationTitle(order.id).navigationBarTitleDisplayMode(.inline)
        .task { cfg = await API.sharedConfig() }
    }
    private var stepIndex: Int? {
        switch order.status {
        case "pending_cod", "paid", "confirmed": return 0
        case "packed": return 1
        case "shipped": return 2
        case "delivered": return 3
        default: return nil
        }
    }
}

struct SubscriptionsView: View {
    let phone: String; let order: String
    @State private var list: [Subscription]?
    @State private var error: String?
    @State private var busy: String?
    @State private var confirmCancel: Subscription?
    @State private var dateFor: Subscription?
    @State private var newDate = Date()
    var body: some View {
        List {
            if let l = list {
                if l.isEmpty {
                    Text("You have no auto-replenish plans. Choose \"Auto-replenish\" on a product page to start one.").foregroundStyle(.secondary)
                }
                ForEach(l) { s in
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(s.status == "paused" ? "Paused" : "Active").font(.caption.bold()).foregroundStyle(.white)
                                    .padding(.horizontal, 8).padding(.vertical, 3).background(s.status == "paused" ? Color.secondary : Color(hex: "#046c4e"), in: Capsule())
                                Spacer()
                                Text("Every \(s.every) month\(s.every == 1 ? "" : "s")").font(.subheadline.bold())
                            }
                            ForEach(s.items, id: \.productId) { i in Text("\(i.qty)× \(i.name)").font(.subheadline) }
                            if s.status != "paused" { Text("Next delivery: \(niceDate(s.nextAt))").font(.footnote).foregroundStyle(Color.rose) }
                            if let e = s.endsAt { Text("Plan ends \(niceDate(e))").font(.caption).foregroundStyle(.secondary) }
                            if let p = s.progress, p.pct > 0 {
                                Text(p.unlocked ? "\(Int(p.pct))% off unlocked on every delivery" : "\(p.done) of \(p.need) deliveries done to unlock \(Int(p.pct))% off").font(.caption).foregroundStyle(.secondary)
                            }
                        }.padding(.vertical, 4)
                        if s.status == "paused" {
                            Button("Resume") { Task { await act(s, "resume") } }
                        } else {
                            Button("Skip next delivery") { Task { await act(s, "skip") } }
                            Button("Change delivery date") { newDate = Date().addingTimeInterval(3 * 86400); dateFor = s }
                            Menu("Change how often") {
                                ForEach([1, 2, 3, 4, 6], id: \.self) { n in Button("Every \(n) month\(n == 1 ? "" : "s")\(n == s.every ? " ✓" : "")") { Task { await act(s, "every", ["every": n]) } } }
                            }
                            Button("Pause") { Task { await act(s, "pause") } }
                        }
                        Button("Cancel plan", role: .destructive) { confirmCancel = s }
                    }.disabled(busy == s.id)
                }
            } else if let e = error {
                Text(e).foregroundStyle(.secondary)
            } else { ProgressView() }
        }
        .navigationTitle("Auto-replenish").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Cancel this plan?", isPresented: Binding(get: { confirmCancel != nil }, set: { if !$0 { confirmCancel = nil } }), titleVisibility: .visible) {
            Button("Cancel plan", role: .destructive) { if let s = confirmCancel { Task { await act(s, "cancel") } } }
        } message: { Text("No more deliveries will be sent. You can start a new plan any time from a product page.") }
        .sheet(item: $dateFor) { s in
            NavigationStack {
                DatePicker("Next delivery", selection: $newDate, in: Date().addingTimeInterval(2 * 86400)...Date().addingTimeInterval(180 * 86400), displayedComponents: .date)
                    .datePickerStyle(.graphical).padding()
                    .navigationTitle("Next delivery").navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dateFor = nil } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Save") {
                                let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = TimeZone(identifier: "Asia/Beirut")
                                let d = f.string(from: newDate); dateFor = nil
                                Task { await act(s, "date", ["date": d]) }
                            }
                        }
                    }
            }.presentationDetents([.medium, .large])
        }
    }
    func load() async {
        let p = phone.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? phone
        let o = order.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? order
        do { list = try await API.get("/api/app/v1/subscriptions?phone=\(p)&order=\(o)", as: SubscriptionList.self).subscriptions; error = nil }
        catch { self.error = "Couldn't load your plans. Pull to try again." }
    }
    func act(_ s: Subscription, _ action: String, _ extra: [String: Any] = [:]) async {
        busy = s.id; defer { busy = nil }
        var body: [String: Any] = ["phone": phone, "order": order.uppercased(), "id": s.id, "action": action]
        extra.forEach { body[$0.key] = $0.value }
        if let (code, _) = try? await API.send("/api/app/v1/subscriptions", body: body), code == 200 { await load() }
        else { error = "That didn't go through. Please try again." }
    }
}
