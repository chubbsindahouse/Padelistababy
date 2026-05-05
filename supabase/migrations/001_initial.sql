-- ============================================================
-- Padel App — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
-- Extends auth.users (one row per registered user)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  avatar_url   text,
  elo_rating   integer not null default 1000,
  total_points integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── SESSIONS ────────────────────────────────────────────────
create table public.sessions (
  id              uuid primary key default uuid_generate_v4(),
  created_by      uuid not null references public.profiles(id),
  date            date not null default current_date,
  format          text not null check (format in ('bo3', 'bo5')),
  winner_stays_on boolean not null default false,
  three_win_rule  boolean not null default false,  -- rotate after 3 consecutive wins
  is_active       boolean not null default true,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── SESSION PLAYERS ─────────────────────────────────────────
create table public.session_players (
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (session_id, player_id)
);

-- ─── MATCHES ─────────────────────────────────────────────────
-- One match = one best-of-N contest between two pairs
create table public.matches (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references public.sessions(id) on delete cascade,
  team_a           uuid[] not null,   -- array of 2 player UUIDs
  team_b           uuid[] not null,   -- array of 2 player UUIDs
  winner_team      text check (winner_team in ('a', 'b')),  -- null while in progress
  consecutive_wins integer not null default 0,  -- used for 3-win rotation tracking
  match_order      integer not null,  -- sequence within the session
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

-- ─── GAMES ───────────────────────────────────────────────────
-- One game = one individual set within a match
create table public.games (
  id         uuid primary key default uuid_generate_v4(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  score_a    integer not null check (score_a >= 0),
  score_b    integer not null check (score_b >= 0),
  game_order integer not null,  -- sequence within the match
  created_at timestamptz not null default now()
);

-- ─── ELO HISTORY ─────────────────────────────────────────────
create table public.elo_history (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid not null references public.profiles(id) on delete cascade,
  session_id    uuid not null references public.sessions(id) on delete cascade,
  rating_before integer not null,
  rating_after  integer not null,
  delta         integer not null generated always as (rating_after - rating_before) stored,
  recorded_at   timestamptz not null default now()
);

-- ─── ACHIEVEMENTS ────────────────────────────────────────────
create table public.achievements (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  badge_key   text not null,
  session_id  uuid references public.sessions(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (player_id, badge_key)  -- each badge earned once
);

-- ─── INDEXES ─────────────────────────────────────────────────
create index on public.sessions (created_by);
create index on public.sessions (is_active);
create index on public.session_players (session_id);
create index on public.session_players (player_id);
create index on public.matches (session_id);
create index on public.games (match_id);
create index on public.elo_history (player_id);
create index on public.elo_history (session_id);
create index on public.achievements (player_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.sessions       enable row level security;
alter table public.session_players enable row level security;
alter table public.matches        enable row level security;
alter table public.games          enable row level security;
alter table public.elo_history    enable row level security;
alter table public.achievements   enable row level security;

-- profiles: anyone authenticated can read all profiles; only owner can update theirs
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

-- sessions: all authenticated users can read; only creator can insert/update/delete
create policy "sessions_select" on public.sessions
  for select using (auth.role() = 'authenticated');
create policy "sessions_insert" on public.sessions
  for insert with check (auth.uid() = created_by);
create policy "sessions_update" on public.sessions
  for update using (auth.uid() = created_by);

-- session_players: all authenticated can read; creator of session can manage
create policy "session_players_select" on public.session_players
  for select using (auth.role() = 'authenticated');
create policy "session_players_insert" on public.session_players
  for insert with check (
    auth.uid() = (select created_by from public.sessions where id = session_id)
  );

-- matches: all authenticated can read; session creator can manage
create policy "matches_select" on public.matches
  for select using (auth.role() = 'authenticated');
create policy "matches_insert" on public.matches
  for insert with check (
    auth.uid() = (select created_by from public.sessions where id = session_id)
  );
create policy "matches_update" on public.matches
  for update using (
    auth.uid() = (select created_by from public.sessions where id = session_id)
  );

-- games: all authenticated can read; session creator can insert
create policy "games_select" on public.games
  for select using (auth.role() = 'authenticated');
create policy "games_insert" on public.games
  for insert with check (
    auth.uid() = (
      select s.created_by from public.sessions s
      join public.matches m on m.session_id = s.id
      where m.id = match_id
    )
  );

-- elo_history & achievements: all authenticated can read
create policy "elo_history_select" on public.elo_history
  for select using (auth.role() = 'authenticated');
create policy "elo_history_insert" on public.elo_history
  for insert with check (auth.role() = 'authenticated');

create policy "achievements_select" on public.achievements
  for select using (auth.role() = 'authenticated');
create policy "achievements_insert" on public.achievements
  for insert with check (auth.role() = 'authenticated');

-- ─── STORAGE BUCKET ──────────────────────────────────────────
-- Run this separately in the Supabase dashboard if preferred
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.role() = 'authenticated'
  );
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
