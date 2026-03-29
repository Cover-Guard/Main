# CoverGuard Android — Play Store TWA

Android app wrapper for CoverGuard using [Trusted Web Activities (TWA)](https://developer.chrome.com/docs/android/trusted-web-activities) via Google's [Android Browser Helper](https://github.com/nicholaswilliams/nickreport-twa) library. The PWA at `coverguard.io` runs fullscreen inside Chrome without browser UI — indistinguishable from a native app.

## Architecture

```
TWA wrapper (this project)
  └── Android Browser Helper (com.google.androidbrowserhelper:2.5.0)
       └── Chrome Custom Tabs (Trusted Web Activity)
            └── coverguard.io (Next.js PWA with service worker)
```

The Android app is a thin launcher that opens the CoverGuard PWA via TWA. All business logic, UI, and data live in the web app. The TWA provides:
- Full-screen experience (no browser chrome)
- Play Store distribution
- Native Android push notifications
- Deep linking (`https://coverguard.io/*`)
- Splash screen

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Java JDK | 17+ | `brew install openjdk@17` / `apt install openjdk-17-jdk` |
| Android SDK | API 35 | [Android Studio](https://developer.android.com/studio) or `sdkmanager` |
| Android Build Tools | 35.0.0 | `sdkmanager "build-tools;35.0.0"` |
| ImageMagick | any | `brew install imagemagick` (for icon generation) |

Set environment:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS
export ANDROID_HOME=$HOME/Android/Sdk           # Linux
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

## Quick Start

### 1. Generate signing keystore

```bash
chmod +x scripts/*.sh
./scripts/setup-keystore.sh
```

This creates `coverguard-release.jks` and `keystore.properties`. **Back up the keystore securely** — you cannot update your app without it.

### 2. Configure Digital Asset Links

After generating your keystore, get the SHA-256 fingerprint:
```bash
keytool -list -v -keystore coverguard-release.jks -alias coverguard
```

Update the fingerprint in two places:
1. **`app/build.gradle`** → `signingCertFingerprint`
2. **`../web/public/.well-known/assetlinks.json`** → `sha256_cert_fingerprints`

Deploy the updated `assetlinks.json` to production. Verify it's accessible at:
```
https://coverguard.io/.well-known/assetlinks.json
```

### 3. Generate icons

Create a 1024x1024 PNG logo, then:
```bash
./scripts/generate-icons.sh path/to/logo-1024.png
```

This generates all Android density icons and web PWA icons.

### 4. Build debug APK

```bash
./gradlew :app:assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### 5. Build release AAB (for Play Store)

```bash
./scripts/build-release.sh
# Output: app/build/outputs/bundle/release/app-release.aab
```

## Google Play Store Submission Checklist

### Required before upload:
- [ ] Signed release AAB built successfully
- [ ] Digital Asset Links verified (`assetlinks.json` deployed and accessible)
- [ ] App icon (512x512) generated
- [ ] Feature graphic (1024x500) created at `store-listing/graphics/feature-graphic.png`
- [ ] At least 2 phone screenshots added to `store-listing/screenshots/`
- [ ] Privacy policy hosted at `https://coverguard.io/privacy`

### In Google Play Console:
- [ ] Create new app → select "App" (not game)
- [ ] Upload AAB in Production → Create new release
- [ ] Fill store listing (see `store-listing/store-listing.md`)
- [ ] Complete content rating questionnaire (see `store-listing/store-listing.md`)
- [ ] Complete data safety form (see `store-listing/data-safety.md`)
- [ ] Set pricing: Free (with in-app subscription)
- [ ] Select countries for distribution
- [ ] Add privacy policy URL: `https://coverguard.io/privacy`
- [ ] Submit for review

### Post-submission:
- [ ] Enable Google Play App Signing (recommended)
- [ ] If using Play App Signing, update `assetlinks.json` with the Play-managed SHA-256
- [ ] Set up staged rollout (e.g., 10% → 50% → 100%)

## Play Store Policy Compliance

| Requirement | Status |
|---|---|
| Target SDK 35 (latest) | Implemented |
| 64-bit support | Handled by AAB |
| Privacy policy | Template at `store-listing/privacy-policy.html` |
| Data safety declaration | Guide at `store-listing/data-safety.md` |
| Content rating | Guide at `store-listing/store-listing.md` |
| Adaptive icons | Implemented (vector drawable) |
| Service worker (offline) | Implemented in web app (`sw.js`) |
| HTTPS only | Enforced via network security config |
| Permissions justified | Declared with rationale in manifest |
| Deceptive behavior | None — TWA shows actual web content |
| Financial features disclosure | Stripe payments disclosed |
| Children's privacy (COPPA) | App not directed at children |

## Project Structure

```
apps/android/
├── app/
│   ├── build.gradle                # App-level build config (TWA settings, signing)
│   ├── proguard-rules.pro          # ProGuard keep rules
│   └── src/main/
│       ├── AndroidManifest.xml     # Permissions, activities, deep links
│       ├── java/io/coverguard/twa/
│       │   ├── LauncherActivity.java              # TWA launcher
│       │   └── TwaNotificationDelegationService.java  # Push notification bridge
│       └── res/
│           ├── drawable/           # Adaptive icon foreground (vector)
│           ├── mipmap-*/           # Density-specific launcher icons
│           ├── values/             # Strings, styles, colors
│           └── xml/                # Network security, file provider paths
├── build.gradle                    # Root build config
├── settings.gradle                 # Project modules
├── gradle.properties               # Build properties
├── gradle/wrapper/                 # Gradle wrapper
├── scripts/
│   ├── setup-keystore.sh           # Keystore generation
│   ├── generate-icons.sh           # Icon asset generation
│   └── build-release.sh            # Release build script
├── store-listing/
│   ├── store-listing.md            # Play Store listing content
│   ├── data-safety.md              # Data safety declaration guide
│   ├── privacy-policy.html         # Privacy policy template
│   ├── screenshots/                # Store screenshots (you provide)
│   └── graphics/                   # Feature graphic + icon (generated)
├── keystore.properties.example     # Signing config template
└── .gitignore
```

## Web App Requirements (already implemented)

The web app at `coverguard.io` must have:
- [x] Valid `manifest.json` with `display: "standalone"`
- [x] Service worker (`sw.js`) with offline fallback
- [x] `/.well-known/assetlinks.json` for domain verification
- [x] HTTPS enabled
- [x] Icons (192x192 and 512x512)

## Troubleshooting

**Browser chrome showing instead of fullscreen:**
- Digital Asset Links not verified. Check that `assetlinks.json` is accessible and the SHA-256 fingerprint matches your signing key.
- Use Chrome DevTools → Application → Manifest to debug.

**App crashes on launch:**
- Ensure Chrome is installed and up to date on the device.
- Check `adb logcat | grep -i coverguard` for errors.

**"App not installed" error:**
- Check that the signing key matches between debug/release builds.
- Uninstall any existing version before installing a different build type.

**Push notifications not working:**
- Verify `enableNotifications` is `true` in `app/build.gradle`.
- The web app must implement the Push API and request notification permission.
