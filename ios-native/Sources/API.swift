import Foundation

/// Talks to the live shop. Every screen reads from here.
enum API {
    static let base = URL(string: "https://www.shopsuperyou.com")!

    static func url(_ path: String) -> URL {
        URL(string: path.hasPrefix("http") ? path : base.absoluteString + path)!
    }

    static func get<T: Decodable>(_ path: String, as: T.Type = T.self) async throws -> T {
        var req = URLRequest(url: url(path))
        req.setValue("SuperYou-iOS", forHTTPHeaderField: "X-Client")
        let (data, res) = try await URLSession.shared.data(for: req)
        if let h = res as? HTTPURLResponse, h.statusCode >= 400 { throw APIError.status(h.statusCode) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    static func post<T: Decodable>(_ path: String, body: [String: Any], as: T.Type = T.self) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("SuperYou-iOS", forHTTPHeaderField: "X-Client")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONDecoder().decode(T.self, from: data)
    }

    static func home() async throws -> Home { try await get("/api/app/v1/home") }
    static func config() async throws -> Config { try await get("/api/app/v1/config") }
    static func product(_ slug: String) async throws -> Product { try await get("/api/app/v1/product/\(slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? slug)") }
    static func products(_ query: String, page: Int = 1) async throws -> ProductPage { try await get("/api/app/v1/products?\(query)&page=\(page)") }
}

enum APIError: LocalizedError {
    case status(Int)
    var errorDescription: String? { if case .status(let c) = self { return "The shop answered \(c). Please try again." }; return nil }
}

/// Turns a shop link (/collections/…, /shop/?…) into a product-list query for the app.
func query(fromHref href: String) -> String {
    guard let comps = URLComponents(string: href.hasPrefix("http") ? href : "https://x" + href) else { return "" }
    var items = comps.queryItems ?? []
    let path = comps.path
    if path.hasPrefix("/collections/") {
        let key = path.dropFirst("/collections/".count).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        items.append(URLQueryItem(name: "collection", value: key))
    } else if path.hasPrefix("/brands/") {
        items.append(URLQueryItem(name: "brand", value: String(path.dropFirst("/brands/".count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
    }
    var c = URLComponents(); c.queryItems = items
    return c.percentEncodedQuery ?? ""
}

func money(_ v: Double) -> String { v == v.rounded() ? "$\(Int(v))" : String(format: "$%.2f", v) }
