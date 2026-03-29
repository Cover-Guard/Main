# ProGuard rules for CoverGuard TWA

# Keep TWA launcher activity
-keep class io.coverguard.twa.LauncherActivity { *; }

# AndroidX Browser / Custom Tabs
-keep class androidx.browser.** { *; }
-keep class androidx.browser.customtabs.** { *; }
-keep class androidx.browser.trusted.** { *; }

# Keep the TrustedWebActivityService for push notifications
-keep class io.coverguard.twa.NotificationPermissionRequestActivity { *; }
