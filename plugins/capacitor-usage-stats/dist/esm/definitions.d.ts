export interface AppUsageEntry {
    packageName: string;
    appName: string;
    category: string;
    totalTimeMinutes: number;
    lastTimeUsed: number;
}
export interface DailyUsageSummary {
    date: string;
    totalScreenTimeMinutes: number;
    nightUsageMinutes: number;
    pickups: number;
    socialMediaPercentage: number;
    avgSessionDurationMinutes: number;
    totalSessions: number;
    apps: AppUsageEntry[];
}
export interface PermissionStatus {
    granted: boolean;
}
export interface UsageStatsPlugin {
    /** Check whether the Usage Access permission has been granted (Android only). */
    hasPermission(): Promise<PermissionStatus>;
    /** Opens the system settings screen where the user can grant Usage Access (Android only). */
    requestPermission(): Promise<void>;
    /** Returns a summary of today's usage, built from the device's real usage stats. */
    getTodaySummary(): Promise<DailyUsageSummary>;
    /** Returns summaries for the last N days (default 7), most recent last. */
    getWeeklySummary(options?: {
        days?: number;
    }): Promise<{
        days: DailyUsageSummary[];
    }>;
    /** Platform capability flag so the web app knows what kind of data to expect. */
    getCapabilities(): Promise<{
        platform: 'android' | 'web';
        perAppData: boolean;
        exactTimes: boolean;
    }>;
}
