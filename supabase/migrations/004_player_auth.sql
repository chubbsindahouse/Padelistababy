-- ============================================================
-- Migration 004 — Player login credentials
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Add username (unique) and password_hash to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Unique index that ignores NULLs (players without credentials assigned yet)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (username)
  WHERE username IS NOT NULL;

-- Supabase Storage: create the avatars bucket (public)
-- Run separately in Storage dashboard if preferred:
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('avatars', 'avatars', true)
--   ON CONFLICT DO NOTHING;
