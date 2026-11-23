import ARKit
import SwiftUI

// MARK: - Models (what /api/app/v1/skin-scan returns)

struct ScanZone: Codable, Hashable { let zone: String; let note: String }
struct ScanAnalysis: Codable, Hashable {
    let skinType: String?; let concerns: [String]; let sensitive: Bool; let observations: [String]; let advice: String
    let zones: [ScanZone]?; let confidence: String?; let photoTips: String?; let redFlags: [String]?
}
struct ScanStep: Codable, Hashable, Identifiable { let id: String; let name: String; let time: String; let tip: String; let picks: [Card] }
struct ScanResult: Codable { let analysis: ScanAnalysis; let steps: [ScanStep]; var treatments: [Treatment]? = nil; var clinic: ClinicInfo? = nil }
private struct ScanError: Codable { let error: String? }

// MARK: - Screen

struct SuperScanView: View {
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
    @State private var consent = false
    @State private var nudge = 0
    @State private var scanning = false
    @State private var simpleShot = false
    @State private var busy = false
    @State private var error: String?
    @State private var result: ScanResult?
    @State private var meshImage: UIImage?
    private let faceID = ARFaceTrackingConfiguration.isSupported

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SuperScan").font(.display(34))
                        Text("3D AI skin scan").font(.headline).foregroundStyle(Color.rose)
                        Text("Like setting up Face ID: look at the screen, slowly move your head in a circle, and the AI reads your skin from five angles. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored.")
                            .font(.subheadline).foregroundStyle(.secondary).padding(.top, 4)
                    }

                    ZStack {
                        if let m = meshImage {
                            Image(uiImage: m).resizable().scaledToFill()
                        } else {
                            ScanPlaceholder()
                        }
                        if busy { Color.black.opacity(0.45); ProgressView("Reading your skin…").tint(.white).foregroundStyle(.white) }
                    }
                    .frame(height: 380).frame(maxWidth: .infinity).clipShape(RoundedRectangle(cornerRadius: 22))

                    consentCard
                    Button {
                        if !consent { withAnimation(.default) { nudge += 1 }; UINotificationFeedbackGenerator().notificationOccurred(.warning); return }
                        error = nil
                        if faceID { scanning = true } else { simpleShot = true }
                    } label: {
                        Label(result == nil ? "Start SuperScan" : "Scan again", systemImage: "faceid").font(.headline).frame(maxWidth: .infinity).padding()
                    }
                    .buttonStyle(.borderedProminent).tint(Color.brand).disabled(busy)
                    if !faceID { Text("This iPhone has no Face ID camera, so SuperScan takes one front-camera photo instead.").font(.caption).foregroundStyle(.secondary) }
                    if let e = error { Text(e).font(.footnote).foregroundStyle(Color.rose) }

                    if let r = result { ResultsView(result: r) } else { tipsCard }
                }.padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $scanning) {
                FaceScanScreen { out in
                    scanning = false
                    guard let out, let front = out["front"] as? String else { return }
                    if let d = out["mesh"] as? Data { meshImage = UIImage(data: d) }
                    let sides = (out["sides"] as? [String]) ?? []
                    let meta: [String: Any] = ["depth": true, "distanceCm": out["distanceCm"] as? Int ?? 0, "light": out["light"] as? Int ?? 0, "colorTemp": out["colorTemp"] as? Int ?? 0]
                    Task { await analyse(front: front, sides: sides, meta: meta) }
                }.ignoresSafeArea()
            }
            .sheet(isPresented: $simpleShot) {
                FrontCameraShot { img in
                    simpleShot = false
                    guard let img, let data = jpegDataURL(img) else { return }
                    meshImage = img
                    Task { await analyse(front: data, sides: [], meta: nil) }
                }.ignoresSafeArea()
            }
        }
    }

    private var consentCard: some View {
        Button { consent.toggle() } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: consent ? "checkmark.square.fill" : "square").font(.system(size: 30)).foregroundStyle(consent ? Color.greenShip : Color.rose)
                VStack(alignment: .leading, spacing: 4) {
                    Text(consent ? "Thank you, you're ready ✓" : "Tick to agree, then start").font(.headline).foregroundStyle(Color.ink)
                    Text("I agree that the 5 photos from my SuperScan are sent once to an AI service to read my skin. They aren't stored.").font(.footnote).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background((consent ? Color(hex: "#ecfdf3") : Color(hex: "#fdeef3")), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(consent ? Color.greenShip : Color.rose, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .modifier(Shake(animatableData: CGFloat(nudge)))
        .accessibilityAddTraits(consent ? .isSelected : [])
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("For the most accurate reading").font(.headline)
            ForEach(["Clean, bare skin: no make-up, no tinted sunscreen", "Daylight from a window in front of you", "No flash, no beauty filters", "Hair back, glasses off", "Move slowly, like setting up Face ID"], id: \.self) { Label($0, systemImage: "checkmark").font(.footnote) }
            Text("SuperScan is a cosmetic assessment, not a medical diagnosis. For anything that worries you, ask our pharmacist or a doctor.").font(.caption).foregroundStyle(.secondary).padding(.top, 4)
        }.padding().background(Color.paper, in: RoundedRectangle(cornerRadius: 16))
    }

    private func analyse(front: String, sides: [String], meta: [String: Any]?) async {
        busy = true; defer { busy = false }
        var body: [String: Any] = ["image": front, "sides": sides]
        if let meta { body["meta"] = meta }
        do {
            let (status, data) = try await API.send("/api/app/v1/skin-scan", body: body)
            if status == 200, let r = try? JSONDecoder().decode(ScanResult.self, from: data) { withAnimation { result = r } }
            else {
                let e = (try? JSONDecoder().decode(ScanError.self, from: data))?.error
                error = e == "not_configured" ? "SuperScan isn't switched on yet." : (e ?? "Please try again.")
            }
        } catch { self.error = "No connection, or the scan took too long. Please try again." }
    }
}

// MARK: - Results

struct ResultsView: View {
    let result: ScanResult
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
    @State private var sendOpen = false
    @State private var shareImage: Image?

    var body: some View {
        let a = result.analysis
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(a.skinType ?? "Your") skin\(a.sensitive ? ", easily irritated" : "")").font(.display(22))
                if !a.concerns.isEmpty { Text("Focus: " + a.concerns.joined(separator: " · ")).font(.subheadline).foregroundStyle(Color.rose) }
                if let c = a.confidence { Text("Confidence: \(c)").font(.caption).foregroundStyle(.secondary) }
                ForEach(a.observations, id: \.self) { Text("• \($0)").font(.footnote) }
                if let z = a.zones, !z.isEmpty {
                    ForEach(z, id: \.self) { Text("\($0.zone.capitalized): \($0.note)").font(.footnote).padding(8).frame(maxWidth: .infinity, alignment: .leading).background(Color.paper, in: RoundedRectangle(cornerRadius: 10)) }
                }
                if let f = a.redFlags, !f.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Please show this to a doctor or pharmacist", systemImage: "exclamationmark.triangle.fill").font(.subheadline.bold())
                        ForEach(f, id: \.self) { Text("• \($0)").font(.footnote) }
                    }.padding(12).background(Color(hex: "#fff4e5"), in: RoundedRectangle(cornerRadius: 12))
                }
                if !a.advice.isEmpty { Text(a.advice).font(.footnote).italic() }
            }.padding().background(Color.white, in: RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: "#eee5ea")))

            Text("Your routine").font(.display(20))
            ForEach(Array(result.steps.enumerated()), id: \.element.id) { i, s in
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(i + 1). \(s.name)  ·  \(s.time == "both" ? "AM + PM" : s.time.uppercased())").font(.headline)
                    Text(s.tip).font(.footnote).foregroundStyle(.secondary)
                    if let p = s.picks.first {
                        NavigationLink(value: p) {
                            HStack {
                                RemoteImage(url: p.image ?? "").frame(width: 54, height: 54).background(Color.white, in: RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading) { Text(p.brand).font(.caption).foregroundStyle(.secondary); Text(p.name).font(.footnote.weight(.semibold)).lineLimit(2); Text(money(p.price)).font(.footnote) }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(.secondary)
                            }
                        }.buttonStyle(.plain)
                    }
                }.padding().background(Color.paper, in: RoundedRectangle(cornerRadius: 14))
            }
            let picks = result.steps.compactMap { $0.picks.first }
            if !picks.isEmpty {
                Button { picks.forEach { bag.addCard($0) }; router.tab = 3 } label: {
                    Text("Add the whole routine to my bag").font(.headline).frame(maxWidth: .infinity).padding()
                }.buttonStyle(.borderedProminent).tint(Color.ink)
            }
            AfterRoutineSection(items: result.treatments ?? [], partner: result.clinic?.partner ?? "DermaPro", mock: result.clinic?.mock ?? true)
            Button { sendOpen = true } label: { Label("Send me my routine (WhatsApp / email)", systemImage: "paperplane").frame(maxWidth: .infinity).padding(12) }.buttonStyle(.bordered)
            if let img = shareImage {
                ShareLink(item: img, preview: SharePreview("My SuperScan", image: img)) {
                    Label("Share to Instagram / Facebook", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).padding(12)
                }.buttonStyle(.bordered).tint(Color.brand)
            }
        }
        .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
        .sheet(isPresented: $sendOpen) { SendRoutineSheet(result: result) }
        .task { shareImage = renderShareCard() }
    }

    /// Story-size picture: skin type and routine (never the face), "Made with SuperScan" and the link to try it.
    @MainActor private func renderShareCard() -> Image? {
        let card = ShareCard(result: result).frame(width: 1080, height: 1920)
        let r = ImageRenderer(content: card)
        r.scale = 1
        guard let ui = r.uiImage else { return nil }
        return Image(uiImage: ui)
    }
}

private struct ShareCard: View {
    let result: ScanResult
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: "#8a3656"), Color(hex: "#c0587a"), Color(hex: "#6d4bb8")], startPoint: .topLeading, endPoint: .bottomTrailing)
            VStack(alignment: .leading, spacing: 40) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SUPERYOU").font(.system(size: 64, weight: .heavy)).foregroundStyle(.white)
                    Text("SUPERSCAN · 3D AI SKIN SCAN").font(.system(size: 30, weight: .bold)).foregroundStyle(.white.opacity(0.85))
                }
                VStack(alignment: .leading, spacing: 24) {
                    Text("My skin today").font(.system(size: 34, weight: .semibold)).foregroundStyle(Color(hex: "#6b5a62"))
                    Text("\(result.analysis.skinType ?? "") skin").font(.system(size: 76, weight: .heavy)).foregroundStyle(Color(hex: "#2e2229"))
                    if !result.analysis.concerns.isEmpty { Text("Focus: " + result.analysis.concerns.joined(separator: " · ")).font(.system(size: 40, weight: .semibold)).foregroundStyle(Color(hex: "#8a3656")) }
                    Text("My routine").font(.system(size: 34, weight: .semibold)).foregroundStyle(Color(hex: "#6b5a62")).padding(.top, 20)
                    ForEach(Array(result.steps.prefix(6).enumerated()), id: \.offset) { i, s in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(i + 1). \(s.name)").font(.system(size: 42, weight: .bold)).foregroundStyle(Color(hex: "#2e2229"))
                            if let p = s.picks.first { Text("\(p.brand) \(p.name)").font(.system(size: 30)).foregroundStyle(Color(hex: "#6b5a62")).lineLimit(1) }
                        }
                    }
                }
                .padding(60).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.96), in: RoundedRectangle(cornerRadius: 48))
                Spacer()
                VStack(spacing: 10) {
                    Text("Made with SuperScan, the 3D AI skin scan").font(.system(size: 40, weight: .bold))
                    Text("Try yours free at").font(.system(size: 36)).opacity(0.85)
                    Text("shopsuperyou.com/superscan").font(.system(size: 52, weight: .heavy))
                }.foregroundStyle(.white).frame(maxWidth: .infinity)
            }.padding(70)
        }
    }
}

/// Send the routine to WhatsApp / email and save it to the account (never the photo).
struct SendRoutineSheet: View {
    let result: ScanResult
    @Environment(\.dismiss) private var dismiss
    @AppStorage("sy.first") private var first = ""
    @AppStorage("sy.phone") private var phone = ""
    @AppStorage("sy.email") private var email = ""
    @State private var busy = false
    @State private var msg: String?
    var body: some View {
        NavigationStack {
            Form {
                SwiftUI.Section(footer: Text("We'll save it (not your photo) and remind you to rescan in 6 weeks. Reply STOP any time.")) {
                    TextField("Your name", text: $first)
                    TextField("WhatsApp number", text: $phone).keyboardType(.phonePad)
                    TextField("Email (optional)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                }
                if let m = msg { Text(m).font(.footnote) }
                Button(busy ? "Sending…" : "Send me my routine") { Task { await send() } }.disabled(busy || (phone.isEmpty && email.isEmpty))
            }
            .navigationTitle("Get your routine").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { dismiss() } } }
        }
    }
    func send() async {
        busy = true; defer { busy = false }
        let steps: [[String: Any]] = result.steps.map { s in
            var d: [String: Any] = ["name": s.name, "time": s.time, "tip": s.tip]
            if let p = s.picks.first { d["product"] = ["slug": p.slug, "name": p.name, "brand": p.brand, "price": p.price] } else { d["product"] = NSNull() }
            return d
        }
        let a = result.analysis
        var analysis: [String: Any] = ["concerns": a.concerns, "sensitive": a.sensitive, "observations": a.observations, "advice": a.advice]
        if let t = a.skinType { analysis["skinType"] = t }
        if let z = a.zones { analysis["zones"] = z.map { ["zone": $0.zone, "note": $0.note] } }
        let body: [String: Any] = ["name": first, "phone": phone, "email": email, "consent": true, "analysis": analysis, "steps": steps]
        if let (status, _) = try? await API.send("/api/app/v1/skin-scan/save", body: body), status == 200 {
            msg = "Saved ✓ We've sent it to you, and we'll remind you in 6 weeks."
        } else { msg = "We couldn't send it. Please check the number and try again." }
    }
}

// MARK: - Bits

/// Face ID-style placeholder: a 3D face mesh turning inside a ring that fills green.
struct ScanPlaceholder: View {
    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                let c = CGPoint(x: size.width / 2, y: size.height * 0.47)
                let r = min(size.width, size.height) * 0.36
                ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: "#151015")))
                // turning face
                let ox = CGFloat(sin(t * 1.05)) * 7, oy = CGFloat(cos(t * 1.05)) * 5
                let face = CGRect(x: c.x - r * 0.55 + ox * 0.4, y: c.y - r * 0.72 + oy * 0.4, width: r * 1.1, height: r * 1.44)
                ctx.stroke(Path(ellipseIn: face), with: .color(Color(hex: "#ffb3cf").opacity(0.9)), lineWidth: 1.4)
                for k in [-0.6, -0.3, 0.0, 0.3, 0.6] {
                    let w = face.width * CGFloat(sqrt(1 - k * k)), y = face.midY + CGFloat(k) * face.height / 2
                    ctx.stroke(Path(ellipseIn: CGRect(x: face.midX - w / 2, y: y - 6, width: w, height: 12)), with: .color(Color(hex: "#ffb3cf").opacity(0.4)), lineWidth: 1)
                }
                for k in [-0.6, -0.2, 0.2, 0.6] {
                    let x = face.midX + CGFloat(k) * face.width / 2 + ox
                    let w = max(3, face.width * CGFloat(sqrt(1 - k * k)) * 0.35)
                    ctx.stroke(Path(ellipseIn: CGRect(x: x - w / 2, y: face.minY, width: w, height: face.height)), with: .color(Color(hex: "#ffb3cf").opacity(0.35)), lineWidth: 1)
                }
                let fx = face.midX + ox, fy = face.midY + oy
                ctx.fill(Path(ellipseIn: CGRect(x: fx - r * 0.22, y: fy - r * 0.18, width: 6, height: 6)), with: .color(.white))
                ctx.fill(Path(ellipseIn: CGRect(x: fx + r * 0.18, y: fy - r * 0.18, width: 6, height: 6)), with: .color(.white))
                var mouth = Path(); mouth.move(to: CGPoint(x: fx - r * 0.18, y: fy + r * 0.32)); mouth.addQuadCurve(to: CGPoint(x: fx + r * 0.18, y: fy + r * 0.32), control: CGPoint(x: fx, y: fy + r * 0.42))
                ctx.stroke(mouth, with: .color(.white), lineWidth: 2)
                // ring of 72 ticks filling green in a loop
                let n = 72, fill = (t.truncatingRemainder(dividingBy: 6)) / 4.2
                for i in 0..<n {
                    let a = Double(i) / Double(n) * 2 * .pi - .pi / 2
                    let on = Double(i) / Double(n) < fill
                    var p = Path()
                    p.move(to: CGPoint(x: c.x + cos(a) * (r + 10), y: c.y + sin(a) * (r + 10)))
                    p.addLine(to: CGPoint(x: c.x + cos(a) * (r + (on ? 28 : 20)), y: c.y + sin(a) * (r + (on ? 28 : 20))))
                    ctx.stroke(p, with: .color(on ? Color(hex: "#4ade80") : .white.opacity(0.3)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
                }
            }
            .overlay(alignment: .bottom) { Text("Your SuperScan will appear here").font(.footnote.weight(.medium)).foregroundStyle(.white.opacity(0.8)).padding(.bottom, 14) }
        }
    }
}

struct Shake: GeometryEffect {
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 8 * sin(animatableData * .pi * 4), y: 0))
    }
}
