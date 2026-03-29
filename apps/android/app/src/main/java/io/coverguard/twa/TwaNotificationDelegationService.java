package io.coverguard.twa;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;

import androidx.browser.trusted.TrustedWebActivityService;

/**
 * Service that delegates push notification handling from the TWA to the web app.
 * Extends TrustedWebActivityService so Chrome can communicate with this app
 * for push notification display.
 */
public class TwaNotificationDelegationService extends TrustedWebActivityService {

    private static final String CHANNEL_ID = "coverguard_notifications";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "CoverGuard Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Notifications from CoverGuard including quote updates and risk alerts.");

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
