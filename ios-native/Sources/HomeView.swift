import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: Router
    @State private var home: Home?
    @State private var error: String?
    @State private var link: Link?
    @State private var cfg: Config?
    @State private var showWheel = false
    @AppStorage("sy.wheelShown") private var wheelShown = false

    struct Link: Identifiable, Hashable { let id = UUID(); let title: String; let query: String }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if home != nil, cfg?.features?.game?.checkin != nil { DailyTip(days: cfg?.features?.game?.checkin?.days ?? 7, points: cfg?.features?.game?.checkin?.points ?? 0) }
                    if let h = home, let secs = h.sections, !secs.isEmpty {
                        // Same blocks, same order as the website's home page.
                        ForEach(secs) { sec in HomeSectionView(sec: sec, open: open, see: { t, href in link = Link(title: t, query: query(fromHref: href)) }, actions: { quickActions }) }
                    } else if let h = home {
                        Promise()
                        quickActions
                        if !h.banners.isEmpty { Banners(banners: h.banners) { b in open(b.href, b.title) } }
                        ForEach(h.rows, id: \.title) { r in
                            ProductRow(title: r.title, eyebrow: nil, cards: r.items) { link = Link(title: r.title, query: r.query) }
                        }
                    } else if let e = error {
                        ContentUnavailable(text: e) { Task { await load() } }
                    } else { ProgressView().frame(maxWidth: .infinity).padding(40) }
                }.padding(.vertical)
            }
            .refreshable { await load() }
            .navigationTitle("SuperYou")
            .toolbar { ToolbarItem(placement: .topBarLeading) { MenuButton() } }
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
            .navigationDestination(item: $link) { ProductListView(title: $0.title, query: $0.query) }
            .navigationDestination(item: $openProduct) { ProductView(slug: $0.slug) }
            .task {
                if home == nil { await load() }
                cfg = await API.sharedConfig()
                if cfg?.features?.wheel != nil, !wheelShown { try? await Task.sleep(nanoseconds: 2_500_000_000); showWheel = true }
            }
            .sheet(isPresented: $showWheel, onDismiss: { wheelShown = true }) { if let w = cfg?.features?.wheel { SpinWheel(wheel: w) } }
            .onChange(of: router.pendingLink) { _, l in if let l { router.pendingLink = nil; open(l, "SuperYou") } }
        }
    }

    func load() async {
        do { home = try await API.home(); error = nil } catch { self.error = "We couldn't load the shop. Check your connection." }
    }
    func open(_ href: String, _ title: String) {
        if href.hasPrefix("/products/") {
            link = nil
            let slug = href.replacingOccurrences(of: "/products/", with: "").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            openProduct = ProductLink(slug: slug)
        } else if href.hasPrefix("/skin-scan") || href.hasPrefix("/superscan") {
            router.tab = 2
        } else if href.hasPrefix("/routine") || href.hasPrefix("/services") || href.hasPrefix("/clinic") || href.hasPrefix("/club") || href.hasPrefix("http") {
            if let u = URL(string: href.hasPrefix("http") ? href : "https://www.shopsuperyou.com\(href)") { UIApplication.shared.open(u) }
        } else { link = Link(title: title, query: query(fromHref: href)) }
    }
    @State private var openProduct: ProductLink?

    /// SuperScan, AI and video-call shortcuts (the website's quick links under the banner).
    var quickActions: some View {
        HStack(spacing: 10) {
            Button { router.tab = 2 } label: { Label("SuperScan", systemImage: "faceid").lineLimit(1).minimumScaleFactor(0.8).frame(maxWidth: .infinity).padding(.vertical, 12) }
                .buttonStyle(.borderedProminent).tint(Color.brand)
            NavigationLink { AdvisorView() } label: { Label("Ask AI", systemImage: "sparkles").frame(maxWidth: .infinity).padding(.vertical, 12) }
                .buttonStyle(.bordered)
            NavigationLink { ServicesView() } label: { Label("Video call", systemImage: "video").frame(maxWidth: .infinity).padding(.vertical, 12) }
                .buttonStyle(.bordered)
        }.font(.footnote.weight(.semibold)).padding(.horizontal)
    }
}

/// A product carousel with a heading and "See all".
struct ProductRow: View {
    let title: String; let eyebrow: String?; let cards: [Card]; let seeAll: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    if let e = eyebrow, !e.isEmpty { Text(e.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose) }
                    Text(title).font(.display(20))
                }
                Spacer()
                Button("See all", action: seeAll).font(.subheadline.weight(.semibold))
            }.padding(.horizontal)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) { ForEach(cards) { c in NavigationLink(value: c) { CardView(card: c).frame(width: 160) }.buttonStyle(.plain) } }.padding(.horizontal)
            }
        }
    }
}

/// Draws one home-page block from the website.
struct HomeSectionView<Actions: View>: View {
    let sec: HomeSection
    let open: (String, String) -> Void
    let see: (String, String) -> Void
    @ViewBuilder let actions: () -> Actions

    var body: some View {
        switch sec.type {
        case "campaign": Campaign(sec: sec, open: open)
        case "banners":
            let items = sec.items ?? []
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    heading
                    Banners(banners: items.map { Banner(eyebrow: $0.eyebrow ?? "", title: $0.title, text: $0.text ?? "", cta: $0.cta ?? "", href: $0.href, image: $0.image ?? "") }) { b in open(b.href, b.title) }
                }
            }
        case "promise":
            VStack(spacing: 14) { Promise(); actions() }
        case "scan":
            Callout(icon: "faceid", title: sec.title ?? "", text: sec.text ?? "", cta: "Start SuperScan") { open("/skin-scan/", "SuperScan") }
        case "pharmacist":
            Callout(icon: "message", title: sec.title ?? "", text: sec.text ?? "", cta: "Chat on WhatsApp") { open("https://wa.me/96170777608", "WhatsApp") }
        case "circles":
            VStack(alignment: .leading, spacing: 10) {
                heading
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(sec.items ?? [], id: \.self) { c in
                            Button { open(c.href, c.title) } label: {
                                VStack(spacing: 6) {
                                    RemoteImage(url: c.image ?? "").padding(10).frame(width: 84, height: 84).background(Color(hex: (c.bg ?? "").isEmpty ? "#f5f5f5" : c.bg!), in: Circle())
                                    Text(c.title).font(.caption.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(2).multilineTextAlignment(.center).frame(width: 84)
                                }
                            }
                        }
                    }.padding(.horizontal)
                }
            }
        case "tiles", "offers":
            VStack(alignment: .leading, spacing: 10) {
                heading
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(sec.items ?? [], id: \.self) { t in
                            Button { open(t.href, t.title) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    if let img = t.image, !img.isEmpty { RemoteImage(url: img).frame(height: 110).frame(maxWidth: .infinity) }
                                    if let b = t.badge, !b.isEmpty { Text(b).font(.caption2.bold()).padding(.horizontal, 8).padding(.vertical, 3).background(Color.rose, in: Capsule()).foregroundStyle(.white) }
                                    Text(t.title).font(.display(16)).foregroundStyle(Color.ink).lineLimit(2)
                                    if let x = t.text, !x.isEmpty { Text(x).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                                    if let c = t.cta, !c.isEmpty { Text(c).font(.caption.weight(.semibold)).foregroundStyle(Color.ink).underline() }
                                }.padding(12).frame(width: 200, alignment: .leading)
                                .background(Color(hex: (t.bg ?? "").isEmpty ? "#f6f1f3" : t.bg!), in: RoundedRectangle(cornerRadius: 22))
                            }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal)
                }
            }
        case "chips":
            VStack(alignment: .leading, spacing: 10) {
                heading
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(sec.items ?? [], id: \.self) { c in
                            Button { open(c.href, c.title) } label: {
                                Text(c.title).font(.subheadline.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 9)
                                    .background(Color.paper, in: Capsule()).overlay(Capsule().stroke(Color.ink.opacity(0.12))).foregroundStyle(Color.ink)
                            }
                        }
                    }.padding(.horizontal)
                }
            }
        case "products":
            if let cards = sec.cards, !cards.isEmpty {
                ProductRow(title: sec.title ?? "", eyebrow: sec.eyebrow, cards: cards) { see(sec.title ?? "Shop", sec.href ?? "/shop/") }
            }
        case "countdown":
            if let end = sec.endsAt.flatMap(ISO8601DateFormatter.loose) {
                Button { open(sec.href ?? "/shop/?sale=1", sec.title ?? "Offers") } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        if let e = sec.eyebrow, !e.isEmpty { Text(e.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose) }
                        Text(sec.title ?? "").font(.display(18)).foregroundStyle(Color.ink)
                        CountdownBoxes(end: end)
                    }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.paper, in: RoundedRectangle(cornerRadius: 22)).padding(.horizontal)
                }.buttonStyle(.plain)
            }
        case "text":
            Callout(icon: nil, title: sec.title ?? "", text: sec.text ?? "", cta: sec.cta ?? "") { if let h = sec.href, !h.isEmpty { open(h, sec.title ?? "") } }
        case "newsletter":
            Newsletter(title: sec.title ?? "Join our newsletter", text: sec.text ?? "")
        default: EmptyView()
        }
    }

    @ViewBuilder var heading: some View {
        if (sec.title ?? "").isEmpty == false || (sec.eyebrow ?? "").isEmpty == false {
            VStack(alignment: .leading, spacing: 2) {
                if let e = sec.eyebrow, !e.isEmpty { Text(e.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose) }
                if let t = sec.title, !t.isEmpty { Text(t).font(.display(20)) }
            }.padding(.horizontal)
        }
    }
}

/// The website's big campaign banner (e.g. Black Friday): badge, title, text, countdown, two buttons, product strip.
struct Campaign: View {
    let sec: HomeSection
    let open: (String, String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let b = sec.badge ?? sec.eyebrow, !b.isEmpty {
                Text(b).font(.caption.weight(.bold)).padding(.horizontal, 12).padding(.vertical, 6).background(Color.ink, in: Capsule()).foregroundStyle(.white)
            }
            Text(sec.title ?? "").font(.display(34)).foregroundStyle(Color.ink)
            if let t = sec.text, !t.isEmpty { Text(t).font(.body).foregroundStyle(Color.ink.opacity(0.8)) }
            if let end = sec.endsAt.flatMap(ISO8601DateFormatter.loose), end > Date() { CountdownBoxes(end: end) }
            HStack(spacing: 10) {
                if let c = sec.cta, !c.isEmpty { Button(c) { open(sec.href ?? "/shop/", c) }.buttonStyle(.borderedProminent).tint(Color.ink) }
                if let c = sec.cta2, !c.isEmpty { Button(c) { open(sec.href2 ?? "/shop/", c) }.buttonStyle(.bordered).tint(Color.ink) }
            }.font(.subheadline.weight(.semibold))
            if let cards = sec.cards, !cards.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 10) { ForEach(cards) { c in NavigationLink(value: c) { CardView(card: c).frame(width: 140) }.buttonStyle(.plain) } }
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: "#ffc2d4"), in: RoundedRectangle(cornerRadius: 26))
        .padding(.horizontal)
    }
}

/// Days, hours, minutes, seconds, ticking every second.
struct CountdownBoxes: View {
    let end: Date
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let left = max(0, Int(end.timeIntervalSince(ctx.date)))
            HStack(spacing: 8) {
                box(left / 86400, "DAYS"); box(left % 86400 / 3600, "HOURS"); box(left % 3600 / 60, "MINS"); box(left % 60, "SECS")
            }
        }
    }
    func box(_ n: Int, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(String(format: "%02d", n)).font(.display(24)).monospacedDigit().foregroundStyle(Color.ink)
                .frame(width: 58, height: 48).background(Color.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 12))
            Text(label).font(.caption2.weight(.semibold)).kerning(1).foregroundStyle(Color.ink.opacity(0.7))
        }
    }
}

/// Soft card with an icon, title, text and one button.
struct Callout: View {
    let icon: String?; let title: String; let text: String; let cta: String; let action: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if let i = icon { Image(systemName: i).font(.title3).foregroundStyle(Color.rose) }
                Text(title).font(.display(18)).foregroundStyle(Color.ink)
            }
            if !text.isEmpty { Text(text).font(.subheadline).foregroundStyle(.secondary) }
            if !cta.isEmpty { Button(cta, action: action).buttonStyle(.borderedProminent).tint(Color.brand).font(.subheadline.weight(.semibold)) }
        }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.paper, in: RoundedRectangle(cornerRadius: 22)).padding(.horizontal)
    }
}

/// Email sign-up, posting to the same list as the website.
struct Newsletter: View {
    let title: String; let text: String
    @State private var email = ""
    @State private var done = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.display(18))
            if !text.isEmpty { Text(text).font(.subheadline).foregroundStyle(.secondary) }
            if done { Label("You're on the list.", systemImage: "checkmark.circle.fill").foregroundStyle(Color.greenShip) }
            else {
                HStack {
                    TextField("Email", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress).textFieldStyle(.roundedBorder)
                    Button("Join") { Task { if (try? await API.send("/api/newsletter/", body: ["email": email]))?.0 == 200 { done = true } } }
                        .buttonStyle(.borderedProminent).tint(Color.brand).disabled(!email.contains("@"))
                }
            }
        }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.paper, in: RoundedRectangle(cornerRadius: 22)).padding(.horizontal)
    }
}

extension ISO8601DateFormatter {
    /// Reads "2026-11-30T23:59", with or without seconds or a time zone.
    static func loose(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        for opts: ISO8601DateFormatter.Options in [[.withInternetDateTime, .withFractionalSeconds], [.withInternetDateTime]] { f.formatOptions = opts; if let d = f.date(from: s) { return d } }
        let df = DateFormatter(); df.locale = Locale(identifier: "en_US_POSIX"); df.timeZone = TimeZone(identifier: "Asia/Beirut")
        for fmt in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"] { df.dateFormat = fmt; if let d = df.date(from: s) { return d } }
        return nil
    }
}

struct ProductLink: Identifiable, Hashable { var id: String { slug }; let slug: String }

struct Promise: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("REVEAL THE SUPER IN YOU").font(.caption2.weight(.bold)).kerning(2).foregroundStyle(Color.rose)
            Text("Every product original. Every question answered. Every order at your door, paid when it arrives.").font(.subheadline.weight(.semibold))
        }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.blush.opacity(0.6), in: RoundedRectangle(cornerRadius: 16)).padding(.horizontal)
    }
}

struct Banners: View {
    let banners: [Banner]
    let tap: (Banner) -> Void
    @State private var page = 0
    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(banners.enumerated()), id: \.offset) { i, b in
                Button { tap(b) } label: {
                    ZStack(alignment: .bottomLeading) {
                        RemoteImage(url: b.image, fit: .fill).frame(maxWidth: .infinity).frame(height: 230).clipped()
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.eyebrow.uppercased()).font(.caption2.weight(.bold)).kerning(1.5).foregroundStyle(Color.rose)
                            Text(b.title).font(.display(20)).foregroundStyle(Color.ink)
                            Text(b.cta).font(.caption.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 6).background(Color.ink, in: Capsule()).foregroundStyle(.white)
                        }.padding(14).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14)).padding(10)
                    }.clipShape(RoundedRectangle(cornerRadius: 18)).padding(.horizontal)
                }.buttonStyle(.plain).tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .frame(height: 250)
        .task { while !Task.isCancelled { try? await Task.sleep(nanoseconds: 6_000_000_000); withAnimation { page = (page + 1) % max(banners.count, 1) } } }
    }
}

struct ContentUnavailable: View {
    let text: String; let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.slash").font(.display(34)).foregroundStyle(.secondary)
            Text(text).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Try again", action: retry).buttonStyle(.borderedProminent)
        }.frame(maxWidth: .infinity).padding(40)
    }
}


/// Today's pharmacist tip; opening the app N days in a row earns Club points (members).
struct DailyTip: View {
    let days: Int; let points: Int
    @AppStorage("sy.phone") private var phone = ""
    @State private var tip = ""
    @State private var streak = 0
    @State private var party = 0
    struct Reply: Codable { struct S: Codable { let streak: Int; let earned: Int }; let tip: String; let streak: S? }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Today's pharmacist tip", systemImage: "lightbulb.fill").font(.caption.weight(.bold)).foregroundStyle(Color.rose)
                Spacer()
                if !phone.isEmpty {
                    HStack(spacing: 3) { ForEach(0..<days, id: \.self) { i in Circle().fill(i < streak ? Color.rose : Color.ink.opacity(0.12)).frame(width: 7, height: 7) } }
                }
            }
            Text(tip.isEmpty ? " " : tip).font(.subheadline).foregroundStyle(Color.ink).redacted(reason: tip.isEmpty ? .placeholder : [])
            if !phone.isEmpty && points > 0 { Text("Open the app \(days) days in a row: +\(points) Club points").font(.caption2).foregroundStyle(.secondary) }
        }
        .padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.paper, in: RoundedRectangle(cornerRadius: 22)).padding(.horizontal)
        .overlay { Confetti(fire: $party) }
        .task {
            guard tip.isEmpty, let res = try? await API.send("/api/app/v1/checkin", body: ["phone": phone]), let r = try? JSONDecoder().decode(Reply.self, from: res.1) else { return }
            tip = r.tip; streak = r.streak?.streak ?? 0
            if (r.streak?.earned ?? 0) > 0 { streak = days; party += 1 }
        }
    }
}

/// Spin-to-win on first launch: every spin wins a welcome discount (the website's sign-up wheel).
struct SpinWheel: View {
    let wheel: Config.Wheel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("sy.phone") private var savedPhone = ""
    @State private var phone = ""
    @State private var angle = 0.0
    @State private var result: (code: String, percent: Int)?
    @State private var busy = false
    @State private var error: String?
    @State private var party = 0
    struct Reply: Codable { let code: String?; let percent: Int?; let index: Int?; let error: String?; let delivered: String? }
    var body: some View {
        VStack(spacing: 18) {
            Text(wheel.title).font(.display(26)).multilineTextAlignment(.center)
            Text(wheel.text).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
            ZStack(alignment: .top) {
                WheelFace(slices: wheel.slices).rotationEffect(.degrees(angle)).frame(width: 260, height: 260)
                Image(systemName: "arrowtriangle.down.fill").font(.title).foregroundStyle(Color.ink).offset(y: -14)
            }
            if let r = result {
                VStack(spacing: 6) {
                    Text("You won \(r.percent)% off 🎉").font(.display(22))
                    if r.code.hasPrefix("sent:") {
                        Text(r.code == "sent:sms" ? "Your code was sent to you by text message." : "Your code was sent to you on WhatsApp.").font(.subheadline).multilineTextAlignment(.center)
                    } else {
                        Text(r.code).font(.system(.title3, design: .monospaced).bold()).padding(.horizontal, 16).padding(.vertical, 8).background(Color.paper, in: Capsule())
                    }
                    Text("Use it at checkout. One use, first order.").font(.caption).foregroundStyle(.secondary)
                    Button("Start shopping") { dismiss() }.buttonStyle(.borderedProminent).tint(Color.brand)
                }
            } else {
                TextField("WhatsApp number", text: $phone).keyboardType(.phonePad).textFieldStyle(.roundedBorder).frame(maxWidth: 280)
                Button { Task { await spin() } } label: { Text(busy ? "Spinning…" : "Spin the wheel").frame(maxWidth: 240).padding(.vertical, 6) }
                    .buttonStyle(.borderedProminent).tint(Color.brand).disabled(busy || phone.filter(\.isNumber).count < 7)
                if let e = error { Text(e).font(.footnote).foregroundStyle(Color.rose) }
                Button("Not now") { dismiss() }.font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(24)
        .overlay { Confetti(fire: $party) }
        .onAppear { if phone.isEmpty { phone = savedPhone } }
        .presentationDetents([.large])
    }
    func spin() async {
        busy = true; error = nil; defer { busy = false }
        guard let res = try? await API.send("/api/signup/", body: ["phone": phone, "via": "whatsapp", "source": "popup"]), let r = try? JSONDecoder().decode(Reply.self, from: res.1) else { error = "We couldn't reach the shop."; return }
        guard let pct = r.percent, let code = r.code ?? r.delivered.map({ "sent:\($0)" }) else { error = r.error ?? "Please try again."; return }
        let n = max(1, wheel.slices.count), i = max(0, r.index ?? 0)
        let slice = 360.0 / Double(n)
        // Land the middle of slice i under the pointer at the top, after a few full turns.
        let target = 360.0 * 5 + (360.0 - (Double(i) * slice + slice / 2))
        withAnimation(.timingCurve(0.15, 0.85, 0.25, 1, duration: 3.2)) { angle = target }
        try? await Task.sleep(nanoseconds: 3_300_000_000)
        if savedPhone.isEmpty { savedPhone = phone }
        result = (code, pct); party += 1
    }
}

struct WheelFace: View {
    let slices: [String]
    var body: some View {
        GeometryReader { g in
            let n = max(1, slices.count), r = min(g.size.width, g.size.height) / 2, c = CGPoint(x: g.size.width / 2, y: g.size.height / 2)
            ZStack {
                ForEach(0..<n, id: \.self) { i in
                    let start = Angle.degrees(Double(i) * 360 / Double(n) - 90), end = Angle.degrees(Double(i + 1) * 360 / Double(n) - 90)
                    Path { p in p.move(to: c); p.addArc(center: c, radius: r, startAngle: start, endAngle: end, clockwise: false); p.closeSubpath() }
                        .fill(i % 2 == 0 ? Color.rose : Color(hex: "#ffc2d4"))
                    let mid = (start.radians + end.radians) / 2
                    Text(slices[i]).font(.caption.bold()).foregroundStyle(i % 2 == 0 ? Color.white : Color.ink)
                        .rotationEffect(.radians(mid + .pi / 2))
                        .position(x: c.x + cos(mid) * r * 0.62, y: c.y + sin(mid) * r * 0.62)
                }
                Circle().stroke(Color.ink, lineWidth: 3)
                Circle().fill(Color.ink).frame(width: 26, height: 26)
            }
        }
    }
}
