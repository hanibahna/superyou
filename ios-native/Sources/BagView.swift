import SwiftUI
import UIKit

struct BagView: View {
    @EnvironmentObject var bag: Bag
    @State private var config: Config?
    @State private var zone = ""
    @State private var code = ""
    @State private var checkout = false
    @State private var party = 0

    var body: some View {
        NavigationStack {
            Group {
                if bag.lines.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bag").font(.system(size: 44)).foregroundStyle(.secondary)
                        Text("Your bag is empty").font(.headline)
                        Text("Originals only. Advice included.").foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        if let c = config, c.delivery.freeThreshold > 0 { Section { Goals(subtotal: bag.subtotal, threshold: c.delivery.freeThreshold, club: c.features?.club, quote: bag.quote) } }
                        ForEach(bag.lines) { l in
                            HStack(spacing: 12) {
                                RemoteImage(url: l.image).frame(width: 64, height: 64).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 10))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(l.brand.uppercased()).font(.caption2).foregroundStyle(.secondary)
                                    Text(l.name).font(.footnote).lineLimit(2)
                                    if !l.variant.isEmpty { Text(l.variant).font(.caption).foregroundStyle(.secondary) }
                                    Text(l.origin == "international" ? "✈ Imported · 10–14 days" : "● Lebanon · 1–3 days").font(.caption2).foregroundStyle(l.origin == "international" ? Color.indigoShip : Color.greenShip)
                                }
                                Spacer()
                                VStack(alignment: .trailing) {
                                    Text(money(l.price * Double(l.qty))).font(.subheadline.bold())
                                    Stepper("\(l.qty)", value: Binding(get: { l.qty }, set: { bag.setQty(l.productId, $0); refresh() }), in: 0...20).labelsHidden().scaleEffect(0.8)
                                }
                            }
                        }
                        if bag.mixed {
                            Text("Your order arrives in two parts: items from Lebanon in 1–3 working days, imported items in 10–14. Shipping, customs duty and VAT are already in the price.").font(.footnote).foregroundStyle(.secondary)
                        }
                        Section {
                            if let c = config, !c.delivery.zones.isEmpty {
                                Picker("Delivery area", selection: $zone) {
                                    Text("Choose").tag("")
                                    ForEach(c.delivery.zones, id: \.self) { Text($0.name).tag($0.name) }
                                }.onChange(of: zone) { _, _ in refresh() }
                            }
                            HStack {
                                TextField("Discount code", text: $code).textInputAutocapitalization(.characters)
                                Button("Apply") { refresh() }
                            }
                            if let e = bag.quote?.couponError { Text(e).font(.footnote).foregroundStyle(Color.rose) }
                        }
                        Section {
                            let q = bag.quote
                            LineRow("Subtotal", money(q?.subtotal ?? bag.subtotal))
                            ForEach(q?.discounts ?? [], id: \.name) { d in LineRow(d.name, "−" + money(d.amount)).foregroundStyle(Color.rose) }
                            LineRow("Delivery", q.map { $0.delivery == 0 ? "Free" : money($0.delivery) } ?? "—")
                            LineRow("Total", money(q?.total ?? bag.subtotal)).font(.headline)
                            Text("Pay cash when it arrives.").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .safeAreaInset(edge: .bottom) {
                        Button { checkout = true } label: { Text("Checkout").font(.headline).frame(maxWidth: .infinity).padding() }
                            .buttonStyle(.borderedProminent).tint(Color.ink).padding()
                            .background(.bar)
                    }
                }
            }
            .navigationTitle("Bag")
            .overlay { Confetti(fire: $party) }
            .onChange(of: bag.subtotal) { old, new in
                // Celebrate the moment the bag crosses the free-delivery line.
                if let t = config?.delivery.freeThreshold, t > 0, old < t, new >= t { party += 1 }
                if let d = bag.quote?.doublePointsAt, d > 0, old < d, new >= d { party += 1 }
            }
            .navigationDestination(isPresented: $checkout) { CheckoutView(config: config, zone: $zone, code: code) }
            .task {
                if config == nil { config = try? await API.config() }
                refresh()
            }
        }
    }
    func refresh() { Task { await bag.refresh(zone: zone, code: code) } }
}

/// Reward ladder like the website's bag: free delivery, double Club points, routine set progress.
struct Goals: View {
    struct Step: Hashable { let at: Double; let label: String; let icon: String }
    let subtotal: Double; let threshold: Double; let club: Config.Club?; let quote: Quote?
    var body: some View {
        let dbl = quote?.doublePointsAt ?? 0
        let steps = ([Step(at: threshold, label: "Free delivery", icon: "shippingbox.fill")] + (dbl > 0 ? [Step(at: dbl, label: "Double points", icon: "sparkles")] : [])).filter { $0.at > 0 }.sorted { $0.at < $1.at }
        let top = steps.map { $0.at }.max() ?? 1
        let next = steps.first { subtotal < $0.at }
        VStack(alignment: .leading, spacing: 10) {
            if let n = next { (Text("Add ") + Text(money(n.at - subtotal)).bold() + Text(" for \(n.label)")).font(.footnote) }
            else { Text("Every reward unlocked 🎉").font(.footnote.bold()).foregroundStyle(Color.rose) }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.ink.opacity(0.08)).frame(height: 8)
                    Capsule().fill(LinearGradient(colors: [.brand, .rose], startPoint: .leading, endPoint: .trailing)).frame(width: g.size.width * min(1, subtotal / top), height: 8)
                    ForEach(steps, id: \.label) { s in
                        Image(systemName: s.icon).font(.system(size: 10, weight: .bold)).foregroundStyle(subtotal >= s.at ? .white : Color.ink.opacity(0.5))
                            .frame(width: 22, height: 22).background(subtotal >= s.at ? Color.rose : Color.white, in: Circle()).overlay(Circle().stroke(Color.ink.opacity(0.12)))
                            .position(x: min(g.size.width - 11, max(11, g.size.width * s.at / top)), y: 4)
                    }
                }
            }.frame(height: 22).animation(.spring(duration: 0.6), value: subtotal)
            HStack(spacing: 12) { ForEach(steps, id: \.label) { s in Text("\(subtotal >= s.at ? "✓" : money(s.at)) \(s.label)").font(.caption2).foregroundStyle(subtotal >= s.at ? Color.ink : .secondary) } }
            if let c = club, c.pointsPerDollar > 0 {
                Text("✦ This order earns \(Int(subtotal * c.pointsPerDollar * (dbl > 0 && subtotal >= dbl ? 2 : 1))) \(c.name) points").font(.caption).foregroundStyle(.secondary)
            }
            if let r = quote?.routine, r.need > 1, r.have > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.have >= r.need ? "Routine set: \(Int(r.percent))% off applied 🎉" : "Your routine: \(r.have) of \(r.need) steps · add \(r.need - r.have) for \(Int(r.percent))% off").font(.caption.bold())
                    HStack(spacing: 3) { ForEach(0..<r.need, id: \.self) { i in Capsule().fill(i < r.have ? Color.rose : Color.ink.opacity(0.1)).frame(height: 5) } }
                    if r.have < r.need { Text("Missing: " + r.all.filter { !r.steps.contains($0) }.prefix(3).joined(separator: ", ")).font(.caption2).foregroundStyle(.secondary) }
                }.padding(8).background(Color.paper, in: RoundedRectangle(cornerRadius: 10))
            }
        }.padding(.vertical, 4)
    }
}

struct LineRow: View {
    let l: String; let r: String
    init(_ l: String, _ r: String) { self.l = l; self.r = r }
    var body: some View { HStack { Text(l); Spacer(); Text(r) } }
}

struct CheckoutView: View {
    let config: Config?
    @Binding var zone: String
    let code: String
    @EnvironmentObject var bag: Bag
    @AppStorage("sy.first") private var first = ""
    @AppStorage("sy.last") private var last = ""
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.email") private var email = ""
    @AppStorage("sy.city") private var city = ""
    @AppStorage("sy.address") private var address = ""
    @AppStorage("sy.lastOrder") private var lastOrder = ""
    @State private var notes = ""
    @State private var waUpdates = true
    @State private var busy = false
    @State private var error: String?
    @State private var done: (id: String, url: String)?
    @State private var party = 0
    @State private var method = "cod"
    @State private var payURL: URL?
    @State private var note: String?

    var body: some View {
        Form {
            if let d = done {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Thank you! Order \(d.id) is in.", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(Color.greenShip)
                        Text(note ?? (method == "cod" ? "We'll confirm on WhatsApp. Pay cash when it arrives." : "We'll confirm on WhatsApp as soon as the payment goes through.")).font(.footnote)
                        if let p = payURL { Link(destination: p) { Label(method == "whish" ? "Pay with Whish" : "Pay by card", systemImage: "creditcard.fill").frame(maxWidth: .infinity).padding(10) }.buttonStyle(.borderedProminent).tint(Color.ink) }
                        if let u = URL(string: API.base.absoluteString + d.url) { Link("Track my order", destination: u) }
                    }
                }
            } else {
                Section("Contact") {
                    TextField("First name", text: $first).textContentType(.givenName)
                    TextField("Last name", text: $last).textContentType(.familyName)
                    TextField("Mobile (e.g. 03 123 456)", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                    TextField("Email (optional)", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never)
                }
                Section("Delivery address") {
                    if let c = config, !c.delivery.zones.isEmpty {
                        Picker("Area", selection: $zone) { Text("Choose").tag(""); ForEach(c.delivery.zones, id: \.self) { Text($0.name).tag($0.name) } }
                    }
                    TextField("Town / neighbourhood", text: $city).textContentType(.addressCity)
                    TextField("Street, building, floor, landmark", text: $address, axis: .vertical).textContentType(.fullStreetAddress)
                    TextField("Notes for the driver (optional)", text: $notes)
                    Toggle("Order updates on WhatsApp", isOn: $waUpdates)
                }
                Section {
                    LineRow("Total", money(bag.quote?.total ?? bag.subtotal)).font(.headline)
                    let methods = config?.payments ?? []
                    if methods.count > 1 {
                        Picker("Payment", selection: $method) { ForEach(methods, id: \.id) { Text($0.label).tag($0.id) } }
                        if let d = methods.first(where: { $0.id == method })?.description { Text(d).font(.caption).foregroundStyle(.secondary) }
                    } else {
                        Text("Payment: cash on delivery").font(.footnote).foregroundStyle(.secondary)
                    }
                    if let e = error { Text(e).foregroundStyle(Color.rose).font(.footnote) }
                    Button { Task { await place() } } label: { Text(busy ? "Placing order…" : "Place order").frame(maxWidth: .infinity) }
                        .disabled(busy || first.isEmpty || last.isEmpty || phone.count < 6 || city.isEmpty || address.count < 3 || zone.isEmpty)
                }
            }
        }
        .navigationTitle(done == nil ? "Checkout" : "Order placed")
        .overlay { Confetti(fire: $party) }
    }

    func place() async {
        busy = true; error = nil; defer { busy = false }
        var body: [String: Any] = [
            "items": bag.lines.map { l -> [String: Any] in var d: [String: Any] = ["productId": l.productId, "qty": l.qty]; if let e = l.every { d["every"] = e }; return d },
            "customer": ["firstName": first, "lastName": last, "phone": phone, "email": email, "zone": zone, "city": city, "address": address, "notes": notes],
            "paymentMethod": method, "waUpdates": waUpdates,
            "attribution": ["source": "ios-app", "medium": "app"],
        ]
        if !code.isEmpty { body["code"] = code }
        do {
            let r = try await API.post("/api/app/v1/checkout", body: body, as: CheckoutReply.self)
            if let id = r.orderId, let u = r.confirmUrl {
                done = (id, u); lastOrder = id; note = r.message; bag.clear()
                party += 1
                OrderUpdates.ask() // first order: now people see why notifications help
                // Card or Whish: open the secure payment page (Whish's page, or our card page on the site).
                if let next = r.next?.redirect, next != u, method != "cod" {
                    let url = next.hasPrefix("http") ? URL(string: next) : URL(string: API.base.absoluteString + next)
                    payURL = url
                    if let url { await UIApplication.shared.open(url) }
                }
            } else { error = r.error ?? "Something went wrong. Please try again." }
        } catch { self.error = "We couldn't reach the shop. Check your connection." }
    }
}
