import { WebPlugin } from '@capacitor/core';
import type { UsageStatsPlugin, DailyUsageSummary, PermissionStatus } from './definitions';

// Web fallback: no real OS-level usage data is accessible from a browser context.
// This keeps the plugin API usable in `npx cap run --livereload` / browser testing
// without crashing, returning empty/zeroed data so the UI can fall back to the
// existing simulator instead of showing native numbers.
export class UsageStatsWeb extends WebPlugin implements UsageStatsPlugin {
  async hasPermission(): Promise<PermissionStatus> {
    return { granted: false };
  }

  async requestPermission(): Promise<void> {
    console.warn('[UsageStats] requestPermission is a no-op on web.');
  }

  async getTodaySummary(): Promise<DailyUsageSummary> {
    return {
      date: new Date().toISOString().slice(0, 10),
      totalScreenTimeMinutes: 0,
      nightUsageMinutes: 0,
      pickups: 0,
      socialMediaPercentage: 0,
      avgSessionDurationMinutes: 0,
      totalSessions: 0,
      apps: []
    };
  }

  async getWeeklySummary(): Promise<{ days: DailyUsageSummary[] }> {
    return { days: [] };
  }

  async getCapabilities() {
    return { platform: 'web' as const, perAppData: false, exactTimes: false };
  }
}
