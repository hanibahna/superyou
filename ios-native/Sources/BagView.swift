import SwiftUI

struct BagView: View {
    @EnvironmentObject var bag: Bag
    @State private var config: Config?
    @State private var zone = ""
    @State private var code = ""
    @State private var checkout = false

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
            .navigationDestination(isPresented: $checkout) { CheckoutView(config: config, zone: $zone, code: code) }
            .task {
                if config == nil { config = try? await API.config() }
                refresh()
            }
        }
    }
    func refresh() { Task { await bag.refresh(zone: zone, code: code) } }
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

    var body: some View {
        Form {
            if let d = done {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Thank you! Order \(d.id) is in.", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(Color.greenShip)
                        Text("We'll confirm on WhatsApp. Pay cash when it arrives.").font(.footnote)
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
                    Text("Payment: cash on delivery").font(.footnote).foregroundStyle(.secondary)
                    if let e = error { Text(e).foregroundStyle(Color.rose).font(.footnote) }
                    Button { Task { await place() } } label: { Text(busy ? "Placing order…" : "Place order").frame(maxWidth: .infinity) }
                        .disabled(busy || first.isEmpty || last.isEmpty || phone.count < 6 || city.isEmpty || address.count < 3 || zone.isEmpty)
                }
            }
        }
        .navigationTitle(done == nil ? "Checkout" : "Order placed")
    }

    func place() async {
        busy = true; error = nil; defer { busy = false }
        var body: [String: Any] = [
            "items": bag.lines.map { ["productId": $0.productId, "qty": $0.qty] },
            "customer": ["firstName": first, "lastName": last, "phone": phone, "email": email, "zone": zone, "city": city, "address": address, "notes": notes],
            "paymentMethod": "cod", "waUpdates": waUpdates,
            "attribution": ["source": "ios-app", "medium": "app"],
        ]
        if !code.isEmpty { body["code"] = code }
        do {
            let r = try await API.post("/api/checkout", body: body, as: CheckoutReply.self)
            if let id = r.orderId, let u = r.confirmUrl { done = (id, u); lastOrder = id; bag.clear() } else { error = r.error ?? "Something went wrong. Please try again." }
        } catch { self.error = "We couldn't reach the shop. Check your connection." }
    }
}
