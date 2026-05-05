-- ============================================================
-- Migration 003 — Remove created_by NOT NULL + FK from sessions
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop the foreign-key constraint (sessions.created_by → profiles.id)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_created_by_fkey;

-- Make the column nullable so admin-created sessions don't need a user ID
ALTER TABLE sessions ALTER COLUMN created_by DROP NOT NULL;

-- Done! Sessions can now be created without a created_by value.
