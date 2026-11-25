import SwiftUI

/// Wholesale enquiry, same form as shopsuperyou.com/wholesale/.
struct WholesaleView: View {
    @State private var business = "", type = "", contact = "", phone = "", email = "", city = "", volume = "", brands = "", message = ""
    @State private var cats: Set<String> = []
    @State private var state = ""
    @State private var err = ""
    private let types = ["Pharmacy", "Beauty salon / spa", "Clinic / dermatologist", "Gym / sports club", "Hotel", "Online shop / reseller", "Corporate gifts", "Other"]
    private let catList = ["Skin care", "Make up", "Hair", "Fragrance", "Body & baby", "Parapharmacy", "Supplements", "Sports nutrition"]
    private let volumes = ["Under $500", "$500 – $2,000", "$2,000 – $10,000", "Over $10,000"]
    var body: some View {
        Form {
            Section { Text("Pharmacies, salons, clinics, gyms, hotels and resellers: buy original brands at wholesale prices, delivered across Lebanon. We reply within one working day.").font(.footnote) }
            if state == "done" {
                Section { Label("Thank you! Our team will contact you within one working day.", systemImage: "checkmark.circle.fill").foregroundStyle(Color(hex: "#046c4e")) }
            } else {
                Section("Your business") {
                    TextField("Business name *", text: $business)
                    Picker("Type of business", selection: $type) { Text("Choose").tag(""); ForEach(types, id: \.self) { Text($0).tag($0) } }
                    TextField("City / area", text: $city)
                    Picker("Expected monthly volume", selection: $volume) { Text("Choose").tag(""); ForEach(volumes, id: \.self) { Text($0).tag($0) } }
                }
                Section("Contact") {
                    TextField("Your name *", text: $contact).textContentType(.name)
                    TextField("Mobile / WhatsApp *", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                    TextField("Email", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never)
                }
                Section("What do you need?") {
                    ForEach(catList, id: \.self) { c in
                        Button { if cats.contains(c) { cats.remove(c) } else { cats.insert(c) } } label: { HStack { Text(c).foregroundStyle(.primary); Spacer(); if cats.contains(c) { Image(systemName: "checkmark").foregroundStyle(Color.rose) } } }
                    }
                    TextField("Brands you're interested in", text: $brands)
                    TextField("Message", text: $message, axis: .vertical).lineLimit(3...6)
                }
                if !err.isEmpty { Section { Text(err).foregroundStyle(.red) } }
                Section { Button(state == "busy" ? "Sending…" : "Send my request") { Task { await send() } }.disabled(state == "busy" || business.count < 2 || contact.count < 2 || phone.count < 6) }
            }
        }.navigationTitle("Wholesale")
    }
    func send() async {
        state = "busy"; err = ""
        let body: [String: Any] = ["business": business, "type": type, "contact": contact, "phone": phone, "email": email, "city": city, "volume": volume, "categories": Array(cats), "brands": brands, "message": message]
        let r = try? await API.send("/api/wholesale/", body: body)
        if r?.0 == 200 { state = "done" } else { state = ""; err = (r.flatMap { try? JSONSerialization.jsonObject(with: $0.1) as? [String: Any] }?["error"] as? String) ?? "Please try again" }
    }
}
