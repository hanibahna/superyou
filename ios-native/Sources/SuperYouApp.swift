import SwiftUI
import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
struct SuperYouApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var bag = Bag()
    @StateObject private var router = Router.shared

    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(bag).environmentObject(router).tint(.rose)
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

/// Push notifications through Firebase (only when GoogleService-Info.plist is in the app).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return true }
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            if granted { DispatchQueue.main.async { application.registerForRemoteNotifications() } }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        Task { _ = try? await API.post("/api/app/push-token", body: ["token": token, "platform": "ios"], as: [String: Bool].self) }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound, .badge] }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        if let url = response.notification.request.content.userInfo["url"] as? String {
            await MainActor.run { Router.shared.pendingLink = url }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var bag: Bag
    @EnvironmentObject var router: Router
    var body: some View {
        TabView(selection: $router.tab) {
            HomeView().tabItem { Label("Home", systemImage: "house") }.tag(0)
            ShopView().tabItem { Label("Shop", systemImage: "magnifyingglass") }.tag(1)
            BagView().tabItem { Label("Bag", systemImage: "bag") }.badge(bag.count).tag(2)
            AccountView().tabItem { Label("Account", systemImage: "person") }.tag(3)
        }
    }
}
