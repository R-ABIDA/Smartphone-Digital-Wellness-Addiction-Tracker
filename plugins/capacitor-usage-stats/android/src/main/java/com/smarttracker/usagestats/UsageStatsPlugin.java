package com.smarttracker.usagestats;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * Reads real on-device usage data via Android's UsageStatsManager.
 *
 * IMPORTANT: This requires the user to manually grant "Usage Access" in
 * Settings > Apps > Special access > Usage access. Android does not allow
 * this permission to be requested via a normal runtime-permission popup —
 * we can only deep-link the user to the settings screen.
 */
@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    // Simple, editable category map. Extend as needed; unknown packages fall back to "Other".
    private static final Map<String, String> CATEGORY_MAP = new HashMap<>();
    static {
        CATEGORY_MAP.put("com.instagram.android", "Social");
        CATEGORY_MAP.put("com.zhiliaoapp.musically", "Social"); // TikTok
        CATEGORY_MAP.put("com.twitter.android", "Social");
        CATEGORY_MAP.put("com.facebook.katana", "Social");
        CATEGORY_MAP.put("com.snapchat.android", "Social");
        CATEGORY_MAP.put("com.whatsapp", "Social");
        CATEGORY_MAP.put("com.reddit.frontpage", "Social");

        CATEGORY_MAP.put("com.Slack", "Work");
        CATEGORY_MAP.put("com.microsoft.office.outlook", "Work");
        CATEGORY_MAP.put("com.google.android.gm", "Work");
        CATEGORY_MAP.put("us.zoom.videomeetings", "Work");
        CATEGORY_MAP.put("com.microsoft.teams", "Work");

        CATEGORY_MAP.put("com.google.android.youtube", "Entertainment");
        CATEGORY_MAP.put("com.netflix.mediaclient", "Entertainment");
        CATEGORY_MAP.put("com.spotify.music", "Entertainment");

        CATEGORY_MAP.put("com.supercell.clashroyale", "Gaming");
        CATEGORY_MAP.put("com.king.candycrushsaga", "Gaming");
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isUsageAccessGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        // There is no runtime-permission dialog for this; deep-link to the settings page.
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        ret.put("perAppData", true);
        ret.put("exactTimes", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getTodaySummary(PluginCall call) {
        if (!isUsageAccessGranted()) {
            call.reject("USAGE_ACCESS_NOT_GRANTED");
            return;
        }
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long startOfDay = cal.getTimeInMillis();
        long now = System.currentTimeMillis();

        JSObject summary = buildDailySummary(startOfDay, now);
        call.resolve(summary);
    }

    @PluginMethod
    public void getWeeklySummary(PluginCall call) {
        if (!isUsageAccessGranted()) {
            call.reject("USAGE_ACCESS_NOT_GRANTED");
            return;
        }
        int days = call.getInt("days", 7);
        JSArray daysArr = new JSArray();

        for (int i = days - 1; i >= 0; i--) {
            Calendar dayStart = Calendar.getInstance();
            dayStart.add(Calendar.DAY_OF_YEAR, -i);
            dayStart.set(Calendar.HOUR_OF_DAY, 0);
            dayStart.set(Calendar.MINUTE, 0);
            dayStart.set(Calendar.SECOND, 0);
            dayStart.set(Calendar.MILLISECOND, 0);
            long start = dayStart.getTimeInMillis();

            Calendar dayEnd = (Calendar) dayStart.clone();
            dayEnd.add(Calendar.DAY_OF_YEAR, 1);
            long end = Math.min(dayEnd.getTimeInMillis(), System.currentTimeMillis());

            daysArr.put(buildDailySummary(start, end));
        }

        JSObject ret = new JSObject();
        ret.put("days", daysArr);
        call.resolve(ret);
    }

    // --- Helpers -----------------------------------------------------------

    private boolean isUsageAccessGranted() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getContext().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private JSObject buildDailySummary(long start, long end) {
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getContext().getPackageManager();

        // NOTE: We deliberately do NOT use UsageStatsManager.queryUsageStats()
        // (INTERVAL_DAILY) to build per-app totals. That API returns
        // pre-aggregated "bucket" data that the system only flushes
        // periodically — right after midnight (or any time before the next
        // flush), it can still hand back a bucket that's really yesterday's,
        // or one whose total includes time outside our [start, end) window.
        // That's what caused screen time / top-apps to look like "yesterday's
        // data". UsageEvents (queryEvents) is the real-time event stream and
        // doesn't have this lag, so we reconstruct exact per-app foreground
        // time from it directly — clipped precisely to [start, end).
        Map<String, Long> perAppMillis = new HashMap<>();

        UsageEvents events = usm.queryEvents(start, end);
        UsageEvents.Event event = new UsageEvents.Event();
        int pickups = 0;
        long nightMillis = 0;
        List<long[]> foregroundSessions = new ArrayList<>(); // [startTs, endTs]
        Map<String, Long> sessionStartByPkg = new HashMap<>();

        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            String pkg = event.getPackageName();
            if (event.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED ||
                    event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                pickups++;
                // If this package was already "open" (missed a pause event),
                // close out the previous session at this resume point before
                // starting a new one, so we never silently drop time.
                Long prevStart = sessionStartByPkg.get(pkg);
                if (prevStart != null) {
                    closeSession(pkg, prevStart, event.getTimeStamp(), perAppMillis, foregroundSessions);
                    nightMillis += overlapWithNightWindow(prevStart, event.getTimeStamp());
                }
                sessionStartByPkg.put(pkg, event.getTimeStamp());
            } else if (event.getEventType() == UsageEvents.Event.ACTIVITY_PAUSED ||
                    event.getEventType() == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                Long sessionStart = sessionStartByPkg.remove(pkg);
                if (sessionStart != null) {
                    long sessionEnd = event.getTimeStamp();
                    closeSession(pkg, sessionStart, sessionEnd, perAppMillis, foregroundSessions);
                    nightMillis += overlapWithNightWindow(sessionStart, sessionEnd);
                }
            }
        }

        // Any app still in the foreground at the end of the window (e.g. the
        // app the user is using right now, including SmartTracker itself)
        // hasn't fired a pause event yet — close its session out at `end` so
        // "right now" usage is still counted instead of dropped.
        for (Map.Entry<String, Long> open : sessionStartByPkg.entrySet()) {
            closeSession(open.getKey(), open.getValue(), end, perAppMillis, foregroundSessions);
            nightMillis += overlapWithNightWindow(open.getValue(), end);
        }

        long totalMillis = 0;
        for (long ms : perAppMillis.values()) totalMillis += ms;

        long socialMillis = 0;
        JSArray appsArr = new JSArray();
        for (Map.Entry<String, Long> entry : perAppMillis.entrySet()) {
            String pkg = entry.getKey();
            long ms = entry.getValue();
            String category = categorize(pkg, pm);
            if ("Social".equals(category)) socialMillis += ms;

            JSObject appObj = new JSObject();
            appObj.put("packageName", pkg);
            appObj.put("appName", resolveAppName(pkg, pm));
            appObj.put("category", category);
            appObj.put("totalTimeMinutes", ms / 60000.0);
            appsArr.put(appObj);
        }

        double socialPct = totalMillis > 0 ? (socialMillis * 100.0 / totalMillis) : 0;
        int totalSessions = foregroundSessions.size();
        double avgSessionMins = totalSessions > 0 ? (totalMillis / 60000.0) / totalSessions : 0;

        JSObject summary = new JSObject();
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        summary.put("date", fmt.format(new java.util.Date(start)));
        summary.put("totalScreenTimeMinutes", totalMillis / 60000.0);
        summary.put("nightUsageMinutes", nightMillis / 60000.0);
        summary.put("pickups", pickups);
        summary.put("socialMediaPercentage", socialPct);
        summary.put("avgSessionDurationMinutes", avgSessionMins);
        summary.put("totalSessions", totalSessions);
        summary.put("apps", appsArr);
        return summary;
    }

    /** Records one foreground session for a package into the running totals. */
    private void closeSession(String pkg, long sessionStart, long sessionEnd,
                               Map<String, Long> perAppMillis, List<long[]> foregroundSessions) {
        if (sessionEnd <= sessionStart) return;
        long dur = sessionEnd - sessionStart;
        perAppMillis.put(pkg, perAppMillis.getOrDefault(pkg, 0L) + dur);
        foregroundSessions.add(new long[]{sessionStart, sessionEnd});
    }

    /** Returns the number of ms of [start,end) that fall within 22:00-05:00 local time. */
    private long overlapWithNightWindow(long start, long end) {
        long total = 0;
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(start);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        // Walk hour by hour across the session range, summing overlap with night hours.
        for (long t = cal.getTimeInMillis(); t < end; t += 3600_000L) {
            long hourStart = Math.max(t, start);
            long hourEnd = Math.min(t + 3600_000L, end);
            if (hourEnd <= hourStart) continue;

            Calendar hc = Calendar.getInstance();
            hc.setTimeInMillis(hourStart);
            int hour = hc.get(Calendar.HOUR_OF_DAY);
            if (hour >= 22 || hour < 5) {
                total += (hourEnd - hourStart);
            }
        }
        return total;
    }

    private String categorize(String pkg, PackageManager pm) {
        if (CATEGORY_MAP.containsKey(pkg)) return CATEGORY_MAP.get(pkg);
        try {
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            int cat = info.category;
            // ApplicationInfo.CATEGORY_* constants (API 26+)
            switch (cat) {
                case ApplicationInfo.CATEGORY_SOCIAL: return "Social";
                case ApplicationInfo.CATEGORY_GAME: return "Gaming";
                case ApplicationInfo.CATEGORY_VIDEO:
                case ApplicationInfo.CATEGORY_AUDIO: return "Entertainment";
                case ApplicationInfo.CATEGORY_PRODUCTIVITY: return "Work";
                default: return "Other";
            }
        } catch (Exception e) {
            return "Other";
        }
    }

    private String resolveAppName(String pkg, PackageManager pm) {
        try {
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (Exception e) {
            return pkg;
        }
    }
}
