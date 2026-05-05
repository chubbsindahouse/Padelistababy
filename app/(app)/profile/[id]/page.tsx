import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { BadgeCard } from "@/components/achievements/badge-card";
import { BADGE_CATALOGUE, formatWinRate } from "@/lib/utils";
import type { Profile, Achievement } from "@/types";

export const revalidate = 0;

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", id).single<Profile>();
  if (!profile) redirect("/leaderboard");

  const { data: allMatches } = await supabase
    .from("matches").select("id, team_a, team_b, winner_team")
    .or(`team_a.cs.{${id}},team_b.cs.{${id}}`).not("winner_team", "is", null);

  const matches = allMatches ?? [];
  const wins = matches.filter((m) => {
    const inA = m.team_a.includes(id);
    return (inA && m.winner_team === "a") || (!inA && m.winner_team === "b");
  }).length;

  const { data: achievements } = await supabase
    .from("achievements").select("*").eq("player_id", id);
  const achList = (achievements ?? []) as Achievement[];
  const unlockedKeys = new Set(achList.map((a) => a.badge_key));

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">
      {/* Hero */}
      <div className="glass-card rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/15 blur-xl" />
            <Avatar name={profile.name} avatarUrl={profile.avatar_url} size="xl" className="relative" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-black text-white">{profile.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold">
                {profile.elo_rating} ELO
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                {profile.total_points} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Matches",  value: matches.length },
          { label: "Wins",     value: wins },
          { label: "Win Rate", value: formatWinRate(wins, matches.length) },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xl font-heading font-black gradient-text">{value}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Badges</p>
          <p className="text-xs text-slate-600">{unlockedKeys.size}/{BADGE_CATALOGUE.length}</p>
        </div>
        <div className="space-y-2">
          {BADGE_CATALOGUE.map((badge) => {
            const ach = achList.find((a) => a.badge_key === badge.key);
            return <BadgeCard key={badge.key} badge={badge} unlockedAt={ach?.unlocked_at ?? null} />;
          })}
        </div>
      </div>
    </div>
  );
}
