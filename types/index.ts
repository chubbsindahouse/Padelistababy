// ─── Database row types ───────────────────────────────────────────────────────

export interface Season {
  id: string;
  number: number;
  name: string;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface SeasonSnapshot {
  id: string;
  season_id: string;
  player_id: string;
  final_elo: number;
  final_points: number;
  final_rank: number;
  match_wins: number;
  match_losses: number;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  elo_rating: number;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  created_by: string | null;
  date: string;
  format: "bo3" | "bo5";
  winner_stays_on: boolean;
  three_win_rule: boolean;
  manual_override: boolean;
  is_active: boolean;
  ended_at: string | null;
  created_at: string;
}

export interface SessionPlayer {
  session_id: string;
  player_id: string;
}

export interface Match {
  id: string;
  session_id: string;
  team_a: string[]; // player UUIDs
  team_b: string[]; // player UUIDs
  winner_team: "a" | "b" | null;
  consecutive_wins: number;
  match_order: number;
  created_at: string;
  completed_at: string | null;
}

export interface Game {
  id: string;
  match_id: string;
  score_a: number;
  score_b: number;
  game_order: number;
  created_at: string;
}

export interface EloHistory {
  id: string;
  player_id: string;
  session_id: string;
  rating_before: number;
  rating_after: number;
  delta: number;
  recorded_at: string;
}

export interface Achievement {
  id: string;
  player_id: string;
  badge_key: BadgeKey;
  session_id: string | null;
  unlocked_at: string;
}

// ─── Badge keys ───────────────────────────────────────────────────────────────

export type BadgeKey =
  | "first_blood"
  | "hat_trick"
  | "iron_man"
  | "giant_killer"
  | "perfect_game"
  | "come_back_kid"
  | "century_club"
  | "dynamic_duo"
  | "top_of_the_table"
  | "consistent"
  | "dominator"
  | "upset_artist";

export interface BadgeMeta {
  key: BadgeKey;
  name: string;
  description: string;
  icon: string; // emoji
}

// ─── Enriched / joined types ─────────────────────────────────────────────────

export interface SessionWithPlayers extends Session {
  players: Profile[];
  matches?: MatchWithGames[];
}

export interface MatchWithGames extends Match {
  games: Game[];
  team_a_profiles?: Profile[];
  team_b_profiles?: Profile[];
}

// ─── New session wizard state ─────────────────────────────────────────────────

export interface NewSessionState {
  step: 1 | 2 | 3 | 4;
  players: string[]; // selected player IDs
  teamingMethod: "manual" | "auto";
  format: "bo3" | "bo5";
  winnerStaysOn: boolean;
  threeWinRule: boolean;
}

// ─── Active session state (client-side) ──────────────────────────────────────

export interface ActiveSessionState {
  session: Session;
  players: Profile[];
  matches: MatchWithGames[];
  currentMatch: MatchWithGames | null;
  waitingQueue: string[]; // player IDs waiting to play
}

// ─── Stats types ─────────────────────────────────────────────────────────────

export interface PlayerStats {
  profile: Profile;
  gamesPlayed: number;
  matchesPlayed: number;
  matchWins: number;
  matchLosses: number;
  winRate: number;
  totalPointsScored: number;
  avgPointsPerGame: number;
  sessionsAttended: number;
  eloHistory: EloHistory[];
  partnerships: PartnershipStat[];
  headToHead: HeadToHeadStat[];
}

export interface PartnershipStat {
  partner: Profile;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface HeadToHeadStat {
  opponent: Profile;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  profile: Profile;
  matchWins: number;
  matchesPlayed: number;
  winRate: number;
}
