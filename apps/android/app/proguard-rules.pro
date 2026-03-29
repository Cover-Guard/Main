# ProGuard rules for CoverGuard TWA

# Keep TWA launcher activity
-keep class io.coverguard.twa.LauncherActivity { *; }

# AndroidX Browser / Custom Tabs
-keep class androidx.browser.** { *; }
-keep class androidx.browser.customtabs.** { *; }
-keep class androidx.browser.trusted.** { *; }

# Keep the TWA notification delegation service
-keep class io.coverguard.twa.TwaNotificationDelegationService { *; }
