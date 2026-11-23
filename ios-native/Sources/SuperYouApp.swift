import SwiftUI
import UIKit
import UserNotifications
#if canImport(FirebaseCore)
import FirebaseCore
import FirebaseMessaging
#endif

/// Order-update notifications are asked for right after the first order, when the reason is obvious.
enum OrderUpdates {
    static func ask() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted { DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() } }
        }
    }
}

@main
struct SuperYouApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var bag = Bag()
    @State private var themeVersion = 0

    init() {
        SiteTheme.registerFonts()
        SiteTheme.styleNavigationBars()
    }
    @StateObject private var wishlist = Wishlist()
    @StateObject private var router = Router.shared

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(bag).environmentObject(wishlist).environmentObject(router)
                .tint(.brand)
                .buttonBorderShape(SiteTheme.pill ? .capsule : .roundedRectangle)
                .id(themeVersion)
                .task {
                    // Match the website's current look; redraw once if it changed since last launch.
                    if SiteTheme.apply(await API.sharedConfig()?.theme) { SiteTheme.styleNavigationBars(); themeVersion += 1 }
                }
        }
    }
}

/// Opens a product list or product from a tapped notification.
@MainActor
final class Router: ObservableObject {
    static let shared = Router()
    @Published var tab = 0
    @Published var pendingLink: String?
}

/// Push notifications through Firebase (only when Firebase is added and GoogleService-Info.plist is in the app).
#if canImport(FirebaseCore)
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return true }
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        // Don't ask at first launch: ask after the first order (OrderUpdates.ask). Re-register if already allowed.
        UNUserNotificationCenter.current().getNotificationSettings { st in
            if st.authorizationStatus == .authorized { DispatchQueue.main.async { application.registerForRemoteNotifications() } }
        }
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) { Messaging.messaging().apnsToken = deviceToken }
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        Task { _ = try? await API.post("/api/app/push-token", body: ["token": token, "platform": "ios"], as: [String: Bool].self) }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound, .badge] }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if let url = response.notification.request.content.userInfo["url"] as? String { await MainActor.run { Router.shared.pendingLink = url } }
    }
}
#else
final class AppDelegate: NSObject, UIApplicationDelegate {}
#endif

struct RootView: View {
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
    var body: some View {
        TabView(selection: $router.tab) {
            HomeView().tabItem { Label("Home", systemImage: "house") }.tag(0)
            ShopView().tabItem { Label("Shop", systemImage: "square.grid.2x2") }.tag(1)
            SuperScanView().tabItem { Label("SuperScan", systemImage: "faceid") }.tag(2)
            BagView().tabItem { Label("Bag", systemImage: "bag") }.badge(bag.count).tag(3)
            AccountView().tabItem { Label("Account", systemImage: "person") }.tag(4)
        }
    }
}
