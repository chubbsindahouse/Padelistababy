-- Add round-robin mode support to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS match_count INT;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_mode_check;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_mode_check CHECK (mode IN ('live', 'round_robin'));
