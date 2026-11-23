import SwiftUI

struct ChatMsg: Identifiable, Hashable { let id = UUID(); let role: String; let text: String; var products: [Card] = [] }
private struct AdvisorReply: Codable { let reply: String?; let products: [Card]?; let error: String? }

/// The AI beauty advisor: recommends products in stock, sends medical questions to the pharmacist.
struct AdvisorView: View {
    @EnvironmentObject var bag: Bag
    @State private var msgs: [ChatMsg] = []
    @State private var text = ""
    @State private var busy = false
    @State private var advisor: Config.Advisor?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(advisor?.greeting ?? "Hi! Tell me about your skin, hair or what you're looking for, and I'll suggest products we have in stock.")
                            .font(.subheadline).padding(12).background(Color.blush.opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                        if msgs.isEmpty, let s = advisor?.suggestions, !s.isEmpty {
                            ForEach(s, id: \.self) { q in Button(q) { send(q) }.font(.footnote).buttonStyle(.bordered) }
                        }
                        ForEach(msgs) { m in bubble(m).id(m.id) }
                        if busy { ProgressView().padding(.leading, 6) }
                        Text("General beauty advice, not a medical diagnosis. For medicines or health worries, ask our pharmacist.").font(.caption2).foregroundStyle(.secondary).padding(.top, 8)
                    }.padding()
                }
                .onChange(of: msgs.count) { _, _ in if let l = msgs.last { withAnimation { proxy.scrollTo(l.id, anchor: .bottom) } } }
            }
            HStack {
                TextField("Ask anything…", text: $text, axis: .vertical).lineLimit(1...4).focused($focused)
                    .padding(10).background(Color.paper, in: RoundedRectangle(cornerRadius: 14))
                Button { send(text) } label: { Image(systemName: "arrow.up.circle.fill").font(.title) }
                    .disabled(busy || text.trimmingCharacters(in: .whitespaces).isEmpty).accessibilityLabel("Send")
            }.padding(10).background(.bar)
        }
        .navigationTitle(advisor?.name ?? "AI advisor").navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Card.self) { ProductView(slug: $0.slug) }
        .task { advisor = await API.sharedConfig()?.features?.advisor }
    }

    @ViewBuilder private func bubble(_ m: ChatMsg) -> some View {
        VStack(alignment: m.role == "user" ? .trailing : .leading, spacing: 8) {
            Text(m.text).font(.subheadline).padding(12)
                .foregroundStyle(m.role == "user" ? .white : Color.ink)
                .background(m.role == "user" ? Color.ink : Color.white, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: "#eee5ea"), lineWidth: m.role == "user" ? 0 : 1))
            if !m.products.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(m.products) { c in
                            VStack(alignment: .leading, spacing: 6) {
                                NavigationLink(value: c) { CardView(card: c).frame(width: 150) }.buttonStyle(.plain)
                                Button("Add to bag") { bag.addCard(c) }.font(.caption.weight(.semibold)).buttonStyle(.bordered)
                            }
                        }
                    }
                }
            }
        }.frame(maxWidth: .infinity, alignment: m.role == "user" ? .trailing : .leading)
    }

    private func send(_ q: String) {
        let t = q.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        msgs.append(ChatMsg(role: "user", text: t)); text = ""; busy = true
        let history = msgs.suffix(20).map { ["role": $0.role, "content": $0.text] }
        Task {
            defer { busy = false }
            guard let (_, data) = try? await API.send("/api/app/v1/advisor", body: ["messages": history]),
                  let r = try? JSONDecoder().decode(AdvisorReply.self, from: data) else {
                msgs.append(ChatMsg(role: "assistant", text: "I couldn't connect. Please try again.")); return
            }
            msgs.append(ChatMsg(role: "assistant", text: r.reply ?? (r.error == "not_configured" ? "The advisor isn't switched on yet." : (r.error ?? "Please try again.")), products: r.products ?? []))
        }
    }
}
