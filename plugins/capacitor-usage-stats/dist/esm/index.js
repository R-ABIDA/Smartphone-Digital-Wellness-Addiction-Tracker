import { registerPlugin } from '@capacitor/core';
const UsageStats = registerPlugin('UsageStats', {
    web: () => import('./web').then(m => new m.UsageStatsWeb()),
});
export * from './definitions';
export { UsageStats };
