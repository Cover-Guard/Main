# ProGuard rules for CoverGuard TWA

# Keep TWA launcher activity
-keep class io.coverguard.twa.LauncherActivity { *; }

# Keep the TWA notification delegation service
-keep class io.coverguard.twa.TwaNotificationDelegationService { *; }

# Android Browser Helper
-keep class com.google.androidbrowserhelper.** { *; }

# AndroidX Browser / Custom Tabs
-keep class androidx.browser.** { *; }
-keep class androidx.browser.customtabs.** { *; }
-keep class androidx.browser.trusted.** { *; }

# AndroidX Core / Splash Screen
-keep class androidx.core.** { *; }
-keep class androidx.core.splashscreen.** { *; }
