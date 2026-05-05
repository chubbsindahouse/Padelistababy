-- ============================================================
-- Migration 005 — Full data reset
-- Deletes all player profiles, sessions, matches, scores,
-- achievements, and ELO history.
-- The admin account is hardcoded and unaffected.
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

TRUNCATE TABLE
  achievements,
  elo_history,
  games,
  matches,
  session_players,
  sessions,
  profiles
CASCADE;
