// native-bridge.js
// Bridges real on-device usage data (Android UsageStatsManager via the
// capacitor-usage-stats plugin) into the same `state.simulatedMetrics` shape
// that app.js already renders from. On iOS/web, where real data isn't
// available, this resolves to null and app.js keeps using its existing
// sample/localStorage data untouched.

window.SmartTrackerNative = (function () {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  async function getPlugin() {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.UsageStats) {
      return null;
    }
    return window.Capacitor.Plugins.UsageStats;
  }

  function mapSummaryToMetrics(summary) {
    return {
      daily_usage_hours: summary.totalScreenTimeMinutes / 60,
      night_usage_hours: summary.nightUsageMinutes / 60,
      app_switching_frequency: summary.pickups,
      social_media_percentage: summary.socialMediaPercentage,
      total_sessions: summary.totalSessions,
      avg_session_duration_mins: summary.avgSessionDurationMinutes
    };
  }

  function mapAppsToCategoryBreakdown(apps) {
    const totals = { Social: 0, Work: 0, Entertainment: 0, Gaming: 0, Other: 0 };
    let grand = 0;
    apps.forEach(a => {
      const cat = totals.hasOwnProperty(a.category) ? a.category : 'Other';
      totals[cat] += a.totalTimeMinutes;
      grand += a.totalTimeMinutes;
    });
    if (grand === 0) return null;
    return Object.keys(totals)
      .filter(k => totals[k] > 0)
      .map(k => ({ label: k, value: Math.round((totals[k] / grand) * 100) }));
  }

  /**
   * Attempts to fetch real device data and returns it pre-shaped for app.js,
   * or null if unavailable (iOS, web, permission not granted yet).
   */
  async function fetchRealMetrics() {
    if (!isNative) return null;
    const plugin = await getPlugin();
    if (!plugin) return null;

    try {
      const caps = await plugin.getCapabilities();
      if (!caps.perAppData) {
        // Defensive fallback — shouldn't happen on Android, but keeps the UI
        // graceful if run on an unsupported device/OS version.
        return { unavailable: true, reason: 'PLATFORM_NOT_SUPPORTED', platform: caps.platform };
      }

      const permission = await plugin.hasPermission();
      if (!permission.granted) {
        return { unavailable: true, reason: 'PERMISSION_NOT_GRANTED', platform: caps.platform };
      }

      const today = await plugin.getTodaySummary();
      const weekly = await plugin.getWeeklySummary({ days: 7 });

      return {
        unavailable: false,
        metrics: mapSummaryToMetrics(today),
        categoryBreakdown: mapAppsToCategoryBreakdown(today.apps),
        weeklyScreenHours: weekly.days.map(d => d.totalScreenTimeMinutes / 60),
        weeklyNightHours: weekly.days.map(d => d.nightUsageMinutes / 60),
        rawToday: today
      };
    } catch (err) {
      console.warn('[SmartTrackerNative] Failed to read native usage stats:', err);
      return { unavailable: true, reason: 'ERROR', error: String(err) };
    }
  }

  async function requestPermission() {
    const plugin = await getPlugin();
    if (!plugin) return;
    await plugin.requestPermission();
  }

  async function hasPermission() {
    const plugin = await getPlugin();
    if (!plugin) return false;
    const res = await plugin.hasPermission();
    return res.granted;
  }

  return {
    isNative,
    fetchRealMetrics,
    requestPermission,
    hasPermission
  };
})();
