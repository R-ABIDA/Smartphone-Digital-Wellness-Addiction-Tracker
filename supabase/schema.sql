-- ============================================================================
-- SmartTracker — Supabase schema
-- ============================================================================
-- Privacy design:
--   - No accounts, emails, or personal identifiers anywhere in this schema.
--   - `device_id` is a random UUID generated locally on the phone on first
--     launch (see www/cloud-sync.js). It identifies an *install*, not a person.
--   - Only app/website name, category, and usage minutes are stored.
--
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================================

-- Per-app/website daily usage. One row per (device, day, app).
create table if not exists device_usage_daily (
  device_id     uuid not null,
  usage_date    date not null,
  package_name  text not null,        -- e.g. "com.instagram.android" or "youtube.com" for web
  app_name      text not null,        -- human-readable label, e.g. "Instagram"
  category      text not null,        -- 'Social' | 'Work' | 'Entertainment' | 'Gaming' | 'Other'
  total_minutes numeric not null default 0,
  synced_at     timestamptz not null default now(),

  primary key (device_id, usage_date, package_name)
);

-- One row per (device, day): the rolled-up metrics your dashboard already renders.
create table if not exists device_daily_summary (
  device_id                  uuid not null,
  usage_date                 date not null,
  total_screen_minutes       numeric not null default 0,
  night_usage_minutes        numeric not null default 0,
  pickups                    integer not null default 0,
  social_media_percentage    numeric not null default 0,
  avg_session_duration_mins  numeric not null default 0,
  total_sessions             integer not null default 0,
  wellness_score             integer,
  synced_at                  timestamptz not null default now(),

  primary key (device_id, usage_date)
);

-- Helpful index for the "latest N days" query the dashboards run.
create index if not exists idx_summary_date on device_daily_summary (usage_date desc);
create index if not exists idx_usage_date on device_usage_daily (usage_date desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- This data has no PII, so we intentionally allow the public "anon" key to
-- read/write it directly from the app and dashboard without a login system.
-- This matches "no user accounts" requirement.
--
-- IMPORTANT if you ever open this app to other people's phones:
--   Anyone with your anon key could currently write/read any device_id's rows.
--   To lock that down later: switch to Supabase Anonymous Auth
--   (supabase.auth.signInAnonymously()) and change these policies to
--   `using (auth.uid() = device_id)` so each install can only touch its own
--   rows. The schema/composite-key design already supports this with zero
--   migration — only the policies below would change.
-- ============================================================================

alter table device_usage_daily enable row level security;
alter table device_daily_summary enable row level security;

create policy "anon can read usage" on device_usage_daily
  for select using (true);
create policy "anon can write usage" on device_usage_daily
  for insert with check (true);
create policy "anon can upsert usage" on device_usage_daily
  for update using (true);

create policy "anon can read summary" on device_daily_summary
  for select using (true);
create policy "anon can write summary" on device_daily_summary
  for insert with check (true);
create policy "anon can upsert summary" on device_daily_summary
  for update using (true);

-- ============================================================================
-- Realtime: lets the live web dashboard auto-refresh as the phone syncs.
-- ============================================================================
alter publication supabase_realtime add table device_daily_summary;
alter publication supabase_realtime add table device_usage_daily;
