package io.coverguard.twa;

import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import androidx.core.splashscreen.SplashScreen;

/**
 * Launcher activity that opens CoverGuard as a Trusted Web Activity.
 *
 * When the Digital Asset Links are verified correctly, Chrome renders the
 * PWA fullscreen without any browser UI — indistinguishable from a native app.
 *
 * If Chrome is not available or verification fails, it falls back to a
 * Chrome Custom Tab (with minimal browser chrome).
 */
public class LauncherActivity extends androidx.appcompat.app.AppCompatActivity {

    private static final String TAG = "LauncherActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install splash screen (Android 12+ requirement)
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        Uri launchUri = Uri.parse(getString(R.string.default_url));

        // Check if incoming intent has a deep link
        Uri intentData = getIntent().getData();
        if (intentData != null) {
            launchUri = intentData;
        }

        launchTwa(launchUri);
    }

    private void launchTwa(Uri uri) {
        try {
            TrustedWebActivityIntentBuilder builder =
                    new TrustedWebActivityIntentBuilder(uri);

            // Configure status bar and navigation bar colors
            CustomTabsIntent.Builder customTabsBuilder = new CustomTabsIntent.Builder();
            customTabsBuilder.setShowTitle(false);

            builder.setToolbarColor(getColor(R.color.colorPrimary))
                    .setNavigationBarColor(getColor(R.color.navigationColor))
                    .setNavigationBarDividerColor(getColor(R.color.navigationDividerColor));

            // Build and launch the TWA
            androidx.browser.trusted.TrustedWebActivityIntent twaIntent =
                    builder.build(customTabsBuilder.build().intent);
            twaIntent.launchTrustedWebActivity(this);

        } catch (Exception e) {
            Log.w(TAG, "TWA launch failed, falling back to Custom Tab", e);
            // Fallback: open in Chrome Custom Tab if TWA fails
            CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .build();
            customTabsIntent.launchUrl(this, uri);
        }

        // Close this activity so back button returns to home
        finish();
    }
}
