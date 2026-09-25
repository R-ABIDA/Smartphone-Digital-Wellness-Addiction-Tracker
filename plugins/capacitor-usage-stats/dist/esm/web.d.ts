import { WebPlugin } from '@capacitor/core';
import type { UsageStatsPlugin, DailyUsageSummary, PermissionStatus } from './definitions';
export declare class UsageStatsWeb extends WebPlugin implements UsageStatsPlugin {
    hasPermission(): Promise<PermissionStatus>;
    requestPermission(): Promise<void>;
    getTodaySummary(): Promise<DailyUsageSummary>;
    getWeeklySummary(): Promise<{
        days: DailyUsageSummary[];
    }>;
    getCapabilities(): Promise<{
        platform: "web";
        perAppData: boolean;
        exactTimes: boolean;
    }>;
}
