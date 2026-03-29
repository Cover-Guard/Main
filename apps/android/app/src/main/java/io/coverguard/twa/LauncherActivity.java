package io.coverguard.twa;

import android.net.Uri;
import android.os.Bundle;

import androidx.core.splashscreen.SplashScreen;

/**
 * Launcher activity that opens CoverGuard as a Trusted Web Activity.
 *
 * Extends the Android Browser Helper's LauncherActivity, which handles
 * all TWA plumbing: CustomTabsSession binding, Digital Asset Links
 * verification, and fullscreen rendering without browser UI.
 *
 * Configuration is driven by meta-data in AndroidManifest.xml:
 *   - DEFAULT_URL: the URL to open
 *   - STATUS_BAR_COLOR, NAVIGATION_BAR_COLOR: theming
 *   - SPLASH_SCREEN_*: splash screen configuration
 *
 * If Chrome is not available or verification fails, it automatically
 * falls back to a Chrome Custom Tab with minimal browser chrome.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install splash screen (Android 12+ requirement)
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Check if incoming intent has a deep link
        Uri intentData = getIntent().getData();
        if (intentData != null) {
            return intentData;
        }
        // Fall back to the default URL from manifest meta-data
        return super.getLaunchingUrl();
    }
}
