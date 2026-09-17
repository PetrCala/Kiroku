package com.alcohol_tracker.liveactivity;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.alcohol_tracker.R;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

/**
 * Android half of the live session on the lock screen (Sessions v2 RFC §8):
 * an ongoing notification with a chronometer counting from the session start,
 * on its own low-importance channel, tapping through to the live session.
 *
 * The counterpart of ios/kiroku/LiveActivityBridge.swift, driven by the same
 * JS entry point (src/libs/actions/LiveActivity.ts). Like it, this is fire and
 * forget: every reason not to show anything (notifications denied, a payload
 * without a session) ends in a quiet return rather than an error thrown back
 * into JS.
 *
 * The elapsed time is never sent from JS. `setWhen` plus `setUsesChronometer`
 * has the system count it, so it stays right while the app is asleep or dead.
 */
public class LiveSessionNotificationModule extends ReactContextBaseJavaModule {

    public static final String NAME = "LiveSessionNotification";

    /** Its own channel, so a user can silence the live session and nothing else. */
    private static final String CHANNEL_ID = "live_session";

    /** One live session at a time, so one fixed id: an update replaces in place. */
    private static final int NOTIFICATION_ID = 1667;

    public LiveSessionNotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    /** A session went live. */
    @ReactMethod
    public void start(ReadableMap payload) {
        post(payload);
    }

    /**
     * Something in the session changed. Posting the same id replaces the
     * notification in place, so start and update are the same act here; only
     * iOS needs them apart.
     */
    @ReactMethod
    public void update(ReadableMap payload) {
        post(payload);
    }

    /** The session closed, or there is no longer one to show. */
    @ReactMethod
    public void end(ReadableMap payload) {
        NotificationManagerCompat.from(getReactApplicationContext()).cancel(NOTIFICATION_ID);
    }

    private void post(ReadableMap payload) {
        Context context = getReactApplicationContext();
        // Covers the Android 13+ POST_NOTIFICATIONS permission that push already
        // asks for, and a user who turned Kiroku's notifications off since.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return;
        }
        String sessionId = getString(payload, "sessionId");
        String deepLink = getString(payload, "deepLink");
        if (TextUtils.isEmpty(sessionId) || TextUtils.isEmpty(deepLink)) {
            return;
        }

        // Past its auto-close deadline, the session is one the server's sweep
        // has closed (or is about to) while this app was not running to hear
        // about it. Showing it as live would be the exact thing `timeoutAfter`
        // exists to prevent, so clear instead of post.
        Long timeout = timeoutFromNow(payload);
        if (timeout != null && timeout <= 0) {
            NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
            return;
        }

        ensureChannel(context, getString(payload, "channelName"));

        long startedAt = (long) getDouble(payload, "startedAt", 0);
        String name = getString(payload, "name");
        String unitsText = getString(payload, "unitsText");
        int drinkCount = (int) getDouble(payload, "drinkCount", 0);
        String drinksLabel = getString(payload, "drinksLabel");

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_notification)
                        .setColor(ContextCompat.getColor(context, R.color.bootsplash_background))
                        .setContentTitle(name)
                        .setContentText(unitsText + " · " + drinkCount + " " + drinksLabel)
                        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        // Every drink reposts this; without it each one would buzz.
                        .setOnlyAlertOnce(true)
                        .setShowWhen(true)
                        .setWhen(startedAt)
                        .setUsesChronometer(true)
                        .setContentIntent(liveSessionIntent(context, deepLink));

        if (timeout != null) {
            builder.setTimeoutAfter(timeout);
        }

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    /**
     * How long this notification may live, or null when nothing caps it.
     * `autoCloseAt` is when the server's stale-session sweep becomes entitled
     * to close the session, computed in JS from the same inputs the sweep uses;
     * `setTimeoutAfter` wants a duration from now. Its absence means the
     * environment has no auto-close configured, so nothing will close the
     * session and nothing should cap the notification either. A value that has
     * already passed comes back as zero or negative, which the caller treats as
     * "do not show this at all".
     */
    private Long timeoutFromNow(ReadableMap payload) {
        double autoCloseAt = getDouble(payload, "autoCloseAt", 0);
        if (autoCloseAt <= 0) {
            return null;
        }
        return (long) autoCloseAt - System.currentTimeMillis();
    }

    /**
     * Low importance: an ongoing session is a status, not an interruption, so
     * it never makes a sound. Creating an existing channel again is how the
     * name is kept in the user's current language; the importance they may
     * have changed is deliberately not reset by it.
     */
    private void ensureChannel(Context context, String channelName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        CharSequence label =
                TextUtils.isEmpty(channelName)
                        ? context.getString(R.string.app_name)
                        : channelName;
        NotificationChannel channel =
                new NotificationChannel(CHANNEL_ID, label, NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    /**
     * Opens the live session through the `kiroku://` deep link the app already
     * handles. MainActivity is `singleTask`, so a running app receives this as
     * a new intent instead of being restarted.
     */
    private PendingIntent liveSessionIntent(Context context, String deepLink) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink));
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String getString(ReadableMap payload, String key) {
        return payload != null && payload.hasKey(key) && !payload.isNull(key)
                ? payload.getString(key)
                : "";
    }

    private static double getDouble(ReadableMap payload, String key, double fallback) {
        return payload != null && payload.hasKey(key) && !payload.isNull(key)
                ? payload.getDouble(key)
                : fallback;
    }
}
