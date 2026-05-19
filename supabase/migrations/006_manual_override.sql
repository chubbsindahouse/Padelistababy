-- ============================================================
-- Migration 006 — manual_override for mid-session roster changes
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add manual_override flag to sessions
-- When true, all subsequent matches use full manual team picking
-- regardless of winner_stays_on setting
alter table public.sessions
  add column if not exists manual_override boolean not null default false;
