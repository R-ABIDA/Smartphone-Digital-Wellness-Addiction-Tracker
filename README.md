# SmartTracker
### Smartphone Digital Wellness & Addiction Tracker

A hybrid Android application with native usage analytics, machine-learning-based risk prediction, and real-time cloud synchronisation.

---

## Project Information

| | |
|---|---|
| **University** | The Apollo University, Murukambattu, Chittoor District, Andhra Pradesh – 517127 |
| **Department** | School of Technology — CSE (AI & DS) |
| **Project** | Internship Report — Batch 2 |
| **Academic Year** | 2025 – 2026 |
| **Internship Duration** | 11 May 2026 – 24 June 2026 (45 Working Days) |
| **Guide** | Mr. E. Ezhilarasan, Assistant Professor, Dept. of CSE (AI & DS) |

**Team Members**
- S. Devi Bangaram (Reg. No. 122311520234)
- R. Abida (Reg. No. 122311520223)
- R. Pujitha (Reg. No. 122311520228)
- M. Hibbah Kausar (Reg. No. 122311520206)

III Year – VI Semester, B.Tech CSE (AI & DS)

---

## Overview

SmartTracker is a Capacitor-based Android app that wraps a web dashboard (HTML/JS/CSS) into a native shell, paired with a custom plugin (`capacitor-usage-stats`) that reads real on-device usage data directly from Android's `UsageStatsManager`.

Key features:
- **Native usage analytics** — screen time, pickups, per-app usage, social-media %, night usage
- **ML-based risk prediction** — flags potential addiction patterns from usage trends
- **Real-time cloud sync** — anonymized metrics pushed to Supabase, viewable on a live web dashboard
- **Graceful fallback** — shows clearly labeled sample data until Usage Access permission is granted, so the app is never broken

---

## Prerequisites

Run these on your own machine (not in a sandbox):

- Node.js 18+
- Android Studio (includes the Android SDK)
- A physical Android phone (recommended) or an emulator

## Setup

### 1. Install dependencies

```bash
cd SmartTrackerApp
npm install
npm run build-plugin
```

### 2. Open in Android Studio

The `android/` folder is already a complete, generated native project:

```bash
npx cap open android
```

(Or: Android Studio → File → Open → select the `android` folder.)

Let Gradle sync finish the first time — this can take a few minutes.

### 3. Run it

- Plug in your phone via USB with **Developer Options → USB Debugging** enabled, or start an emulator from Android Studio's Device Manager.
- Click the green **Run ▶** button.

To build an installable `.apk`: **Build → Build Bundle(s)/APK(s) → Build APK(s)**. It lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

### 4. Grant Usage Access

On first launch, the dashboard shows a **"Grant Usage Access"** banner. Tapping it deep-links to system settings — enable the toggle for SmartTracker, then return to the app. It auto-refreshes with real data.

### 5. Making future changes to the web UI

Edit files in `www/`, then:

```bash
npx cap sync android
```

Re-run from Android Studio.

---

## Cloud Sync — Live Data via Supabase

The app pushes anonymized usage data to Supabase for live viewing on a separate web dashboard.

**Privacy design:** No accounts, emails, or names anywhere. Each install generates a random `device_id` (a UUID stored only in local storage) just to distinguish installs — not linked to any person. Only app/website names, categories, and minutes used are stored.

> **Note:** This submission does not include live Supabase credentials (Project URL / anon API key), as a private personal Supabase account was used during development. For evaluation or further development, set up your own free Supabase project as below.

### Setup (5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates two tables and enables Realtime on them.
3. Go to **Project Settings → API**, copy your **Project URL** and **anon public key**.
4. Paste them into `www/supabase-config.js`:
   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://xxxxxxxxxxxx.supabase.co',
     anonKey: 'eyJhbGciOiJI...'
   };
   ```
5. Run `npx cap sync android` again so the updated config is copied into the build.
6. Rebuild/run the app. Once metrics render on the Dashboard tab, they auto-sync to Supabase (throttled to once every few seconds).

### Viewing the live dashboard

Open `dashboard/live-dashboard.html` directly in any browser. It:
- Lists every `device_id` that has synced data
- Shows today's metrics, a per-app/website breakdown table, and the last 7 days
- Auto-refreshes via Supabase Realtime when your phone syncs new data

### Schema reference
```
device_daily_summary (device_id, usage_date)  -- composite primary key
  total_screen_minutes, night_usage_minutes, pickups,
  social_media_percentage, avg_session_duration_mins,
  total_sessions, wellness_score, synced_at

device_usage_daily (device_id, usage_date, package_name)  -- composite primary key
  app_name, category, total_minutes, synced_at
```
Composite primary keys mean every sync is a safe `upsert` — re-syncing the same day updates that row instead of creating duplicates.

### Tightening security later
The anon key currently allows read/write to any device's rows — acceptable for personal use since there's no sensitive data. For wider deployment, switch to Supabase Anonymous Auth (`supabase.auth.signInAnonymously()`) and update the RLS policies in `schema.sql` to `using (auth.uid() = device_id)`. No schema changes needed — only the policies.

---

## Project Structure
```
SmartTrackerApp/
├── www/                            # dashboard UI/logic
│   ├── index.html
│   ├── app.js                      # + native-data + cloud-sync hooks
│   ├── native-bridge.js            # bridges device data into app state
│   ├── cloud-sync.js                # pushes anonymized metrics to Supabase
│   ├── supabase-config.js          # Supabase URL + anon key go here
│   ├── charts.js
│   ├── audio.js
│   └── style.css
├── dashboard/
│   └── live-dashboard.html         # standalone live web dashboard
├── supabase/
│   └── schema.sql                  # run once in Supabase SQL editor
├── plugins/capacitor-usage-stats/  # custom native plugin
│   ├── src/                        # TypeScript interface + web fallback
│   └── android/                    # UsageStatsManager implementation (Java)
├── android/                         # ready-to-open Android Studio project
├── capacitor.config.json
└── package.json
```

## Known Limitations
- **Android minSdk 23+** required (UsageStatsManager needs API 21+, events API 23+).
- Usage Access is a manual, per-device grant — Android does not allow pre-approval or popup requests. This is an OS privacy design choice, not an app limitation.
- On some OEM skins (Xiaomi/MIUI, some Huawei devices), an extra "Autostart"/battery-optimization step may be needed for background accuracy. Not required for the basic UsageStats query used here, but relevant if background sync is added later.

## Status
The application has been tested and is working as intended — native usage analytics, ML-based risk prediction, and real-time cloud sync are all functioning correctly. Day-to-day progress is documented in the accompanying Excel report.
