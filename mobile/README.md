# SuperYou iOS and Android apps

The apps open the live shop (https://www.shopsuperyou.com), so products, prices, offers and pages update in
the apps the moment they change in the control panel. On top of the site they add: an app icon and splash
screen, push notifications (Admin → Marketing → Mobile app & push), the phone's share sheet, a status bar in
the SuperYou colours, and an offline screen with a WhatsApp link.

- App name: **SuperYou** · App ID: **com.shopsuperyou.app**
- Icons and splash screens: generated from `assets/` (`npm run assets`)
- Native projects: `android/` (Android Studio) and `ios/` (Xcode)

## What you need (in your own name; I can't sign up or pay for these)

| Store | Account | Cost |
|---|---|---|
| Apple App Store | Apple Developer Program, as an organisation (needs the company's D-U-N-S number) | $99 a year |
| Google Play | Google Play Console, organisation account | $25 once |
| Push notifications | Google Firebase project (free) | Free |

## One-time set-up

1. **Firebase**: create a project, add an Android app (`com.shopsuperyou.app`) and an iOS app (same ID).
   - Put `google-services.json` in `android/app/`.
   - Put `GoogleService-Info.plist` in `ios/App/App/` (drag it into Xcode, "Copy if needed").
   - In Firebase → Project settings → Cloud Messaging, upload your Apple push key (APNs `.p8`).
   - In Firebase → Service accounts → Generate new private key, paste the file into the control panel
     (Admin → Mobile app & push → Firebase key).
2. **Xcode** (on a Mac): open `ios/App/App.xcworkspace`, choose your team under Signing & Capabilities, and add
   the **Push Notifications** and **Background Modes → Remote notifications** capabilities.

## Build and publish

```bash
cd mobile
npm install
npx cap sync
npx cap open android   # Android Studio → Build → Generate Signed Bundle (.aab) → upload to Play Console
npx cap open ios       # Xcode → Product → Archive → Distribute → App Store Connect
```

Every push to `main` that touches `mobile/` also builds a test Android APK on GitHub
(Actions → Mobile apps → Artifacts) and checks the iOS project compiles.

## Store listing checklist

- Name: SuperYou · Subtitle: Original beauty & pharmacy
- Category: Shopping (secondary: Health & Fitness)
- Privacy policy and support pages on shopsuperyou.com
- Screenshots: 6.7" and 5.5" iPhone, Android phone (take them from the app on a phone or simulator)
- Apple asks apps that let people create an account to also let them delete it in the app: done
  (Account → Delete my account).
- Apple can reject apps that are "just a website". Ours adds push notifications, the share sheet and an
  offline screen; mention these in the review notes.
