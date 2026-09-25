// cloud-sync.js
// Pushes anonymized usage data (no personal info) to Supabase so it can be
// viewed live in the separate web dashboard. Works with either real native
// data (Android) or the default sample data, so you can test the live dashboard
// before the Android build is ready.

window.SmartTrackerCloud = (function () {
  const DEVICE_ID_KEY = 'smarttracker_device_id';
  let client = null;
  let deviceId = null;

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function isConfigured() {
    return window.SUPABASE_CONFIG &&
      window.SUPABASE_CONFIG.url &&
      !window.SUPABASE_CONFIG.url.includes('YOUR-PROJECT-REF') &&
      window.SUPABASE_CONFIG.anonKey &&
      !window.SUPABASE_CONFIG.anonKey.includes('YOUR-ANON');
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase || !isConfigured()) return null;
    client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    return client;
  }

  function todayStr() {
    // IMPORTANT: Date.toISOString() always returns the UTC date, not the
    // device's local date. For timezones ahead of UTC (e.g. IST, UTC+5:30),
    // toISOString() rolls over to "yesterday" for every local time between
    // midnight and the UTC rollover (00:00-05:30 IST) — which is exactly the
    // window most people check their screen time after waking up. That
    // mismatch was tagging the day's sync rows with the wrong date. This
    // builds the YYYY-MM-DD string from local fields instead.
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Pushes today's rolled-up metrics + per-app breakdown to Supabase.
   * Accepts the same `metrics` shape as state.simulatedMetrics, an optional
   * array of {appName, packageName, category, totalTimeMinutes}, and the
   * current wellness score.
   */
  async function syncToday(metrics, apps, wellnessScore) {
    const sb = getClient();
    if (!sb) return { skipped: true, reason: isConfigured() ? 'CLIENT_INIT_FAILED' : 'NOT_CONFIGURED' };

    deviceId = deviceId || getOrCreateDeviceId();
    const date = todayStr();

    const summaryRow = {
      device_id: deviceId,
      usage_date: date,
      total_screen_minutes: Math.round(metrics.daily_usage_hours * 60),
      night_usage_minutes: Math.round(metrics.night_usage_hours * 60),
      pickups: Math.round(metrics.app_switching_frequency),
      social_media_percentage: Math.round(metrics.social_media_percentage),
      avg_session_duration_mins: metrics.avg_session_duration_mins,
      total_sessions: Math.round(metrics.total_sessions),
      wellness_score: wellnessScore ?? null,
      synced_at: new Date().toISOString()
    };

    const { error: summaryError } = await sb
      .from('device_daily_summary')
      .upsert(summaryRow, { onConflict: 'device_id,usage_date' });

    let appsError = null;
    if (apps && apps.length) {
      const appRows = apps.map(a => ({
        device_id: deviceId,
        usage_date: date,
        package_name: a.packageName || a.appName,
        app_name: a.appName,
        category: a.category || 'Other',
        total_minutes: a.totalTimeMinutes,
        synced_at: new Date().toISOString()
      }));
      const res = await sb
        .from('device_usage_daily')
        .upsert(appRows, { onConflict: 'device_id,usage_date,package_name' });
      appsError = res.error;
    }

    if (summaryError || appsError) {
      console.warn('[SmartTrackerCloud] sync error', summaryError, appsError);
      return { skipped: false, error: summaryError || appsError };
    }
    return { skipped: false, deviceId };
  }

  return {
    isConfigured,
    getDeviceId: () => deviceId || getOrCreateDeviceId(),
    syncToday
  };
})();
