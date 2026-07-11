-- ============================================================
-- Migration 007 — Seasons
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── SEASONS TABLE ───────────────────────────────────────────
CREATE TABLE public.seasons (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  number     integer NOT NULL UNIQUE,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz
);

-- Insert Season 1, backdated to the earliest session
INSERT INTO public.seasons (number, name, is_active, started_at, ended_at)
VALUES (
  1,
  'Season 1',
  false,
  COALESCE((SELECT MIN(created_at) FROM public.sessions), now()),
  now()
);

-- Insert Season 2 as the active season (fresh slate)
INSERT INTO public.seasons (number, name, is_active, started_at)
VALUES (2, 'Season 2', true, now());

-- ─── ADD season_id TO sessions ───────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id);

-- All existing sessions belong to Season 1
UPDATE public.sessions
SET season_id = (SELECT id FROM public.seasons WHERE number = 1)
WHERE season_id IS NULL;

-- ─── ADD season_id TO achievements ───────────────────────────
ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id);

-- Populate season_id from the session's season
UPDATE public.achievements a
SET season_id = s.season_id
FROM public.sessions s
WHERE a.session_id = s.id
  AND s.season_id IS NOT NULL
  AND a.season_id IS NULL;

-- Any remaining (orphaned session or null) → Season 1
UPDATE public.achievements
SET season_id = (SELECT id FROM public.seasons WHERE number = 1)
WHERE season_id IS NULL;

-- Drop old all-time unique constraint, replace with per-season unique
ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_player_id_badge_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS achievements_player_badge_season_unique
  ON public.achievements (player_id, badge_key, season_id);

-- ─── SEASON SNAPSHOTS ────────────────────────────────────────
-- Records each player's final stats when a season ends
CREATE TABLE public.season_snapshots (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id    uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  final_elo    integer NOT NULL,
  final_points integer NOT NULL,
  final_rank   integer NOT NULL,
  match_wins   integer NOT NULL DEFAULT 0,
  match_losses integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, player_id)
);

-- Snapshot Season 1 from current profile values
-- (rank = position sorted by total_points desc)
INSERT INTO public.season_snapshots (season_id, player_id, final_elo, final_points, final_rank, match_wins, match_losses)
SELECT
  (SELECT id FROM public.seasons WHERE number = 1),
  p.id,
  p.elo_rating,
  p.total_points,
  ROW_NUMBER() OVER (ORDER BY p.total_points DESC, p.elo_rating DESC),
  COALESCE(wins.cnt, 0),
  COALESCE(losses.cnt, 0)
FROM public.profiles p
LEFT JOIN (
  SELECT unnest(
    CASE WHEN m.winner_team = 'a' THEN m.team_a ELSE m.team_b END
  ) AS player_id, COUNT(*) AS cnt
  FROM public.matches m
  WHERE m.winner_team IS NOT NULL
  GROUP BY 1
) wins ON wins.player_id = p.id
LEFT JOIN (
  SELECT unnest(
    CASE WHEN m.winner_team = 'a' THEN m.team_b ELSE m.team_a END
  ) AS player_id, COUNT(*) AS cnt
  FROM public.matches m
  WHERE m.winner_team IS NOT NULL
  GROUP BY 1
) losses ON losses.player_id = p.id;

-- Reset all profiles for Season 2
UPDATE public.profiles
SET elo_rating = 1000, total_points = 0;

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS seasons_is_active ON public.seasons (is_active);
CREATE INDEX IF NOT EXISTS sessions_season_id ON public.sessions (season_id);
CREATE INDEX IF NOT EXISTS season_snapshots_season_id ON public.season_snapshots (season_id);
CREATE INDEX IF NOT EXISTS achievements_season_id ON public.achievements (season_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.seasons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_select" ON public.seasons
  FOR SELECT USING (true);

CREATE POLICY "season_snapshots_select" ON public.season_snapshots
  FOR SELECT USING (true);
