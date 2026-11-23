import SwiftUI
import WebKit

/// A small in-app web view (YouTube players, video calls, pages).
struct WebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let c = WKWebViewConfiguration()
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        let w = WKWebView(frame: .zero, configuration: c)
        w.isOpaque = false
        w.backgroundColor = .black
        w.load(URLRequest(url: url))
        return w
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
