-- ============================================================
-- Migration 002 — Remove Supabase Auth dependency
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Wipe all data (removes email-auth profiles and all related data)
DELETE FROM achievements;
DELETE FROM elo_history;
DELETE FROM games;
DELETE FROM matches;
DELETE FROM session_players;
DELETE FROM sessions;
DELETE FROM profiles;

-- 2. Drop the foreign-key constraint linking profiles → auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Give profiles its own default UUID (no longer tied to auth)
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Disable Row Level Security on all tables
--    (The app no longer uses per-user auth — admin cookie handles access control)
ALTER TABLE profiles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches         DISABLE ROW LEVEL SECURITY;
ALTER TABLE games           DISABLE ROW LEVEL SECURITY;
ALTER TABLE elo_history     DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements    DISABLE ROW LEVEL SECURITY;

-- 5. Drop all old auth-based RLS policies (if they still exist)
DROP POLICY IF EXISTS "profiles_select_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"           ON profiles;
DROP POLICY IF EXISTS "sessions_select_participant"   ON sessions;
DROP POLICY IF EXISTS "sessions_insert_authenticated" ON sessions;
DROP POLICY IF EXISTS "session_players_select"        ON session_players;
DROP POLICY IF EXISTS "session_players_insert"        ON session_players;
DROP POLICY IF EXISTS "matches_select"                ON matches;
DROP POLICY IF EXISTS "matches_insert"                ON matches;
DROP POLICY IF EXISTS "matches_update"                ON matches;
DROP POLICY IF EXISTS "games_select"                  ON games;
DROP POLICY IF EXISTS "games_insert"                  ON games;
DROP POLICY IF EXISTS "elo_history_select"            ON elo_history;
DROP POLICY IF EXISTS "achievements_select"           ON achievements;

-- 6. Grant anon role full access to all tables
--    (public read + write is fine since auth is handled at the API layer)
GRANT ALL ON profiles        TO anon;
GRANT ALL ON sessions        TO anon;
GRANT ALL ON session_players TO anon;
GRANT ALL ON matches         TO anon;
GRANT ALL ON games           TO anon;
GRANT ALL ON elo_history     TO anon;
GRANT ALL ON achievements    TO anon;

-- 7. Also grant to authenticated role (in case Supabase still uses it internally)
GRANT ALL ON profiles        TO authenticated;
GRANT ALL ON sessions        TO authenticated;
GRANT ALL ON session_players TO authenticated;
GRANT ALL ON matches         TO authenticated;
GRANT ALL ON games           TO authenticated;
GRANT ALL ON elo_history     TO authenticated;
GRANT ALL ON achievements    TO authenticated;

-- Done! All existing profiles deleted, auth dependency removed.
-- Use the Admin panel in the app to create fresh player profiles.
