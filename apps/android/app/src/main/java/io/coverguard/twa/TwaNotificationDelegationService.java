package io.coverguard.twa;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

/**
 * Service that delegates push notification handling from the TWA to the web app.
 * This allows the PWA's push notifications to show as native Android notifications.
 */
public class TwaNotificationDelegationService extends Service {

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
