import { registerPlugin } from '@capacitor/core';
import type { UsageStatsPlugin } from './definitions';

const UsageStats = registerPlugin<UsageStatsPlugin>('UsageStats', {
  web: () => import('./web').then(m => new m.UsageStatsWeb()),
});

export * from './definitions';
export { UsageStats };
