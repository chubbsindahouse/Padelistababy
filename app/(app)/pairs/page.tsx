import { createClient } from "@/lib/supabase/server";
import { PairsClient } from "@/components/pairs/pairs-client";
import type { Profile } from "@/types";
import type { PairRow } from "@/components/pairs/pairs-client";

export const revalidate = 30;

export default async function PairsPage() {
  const supabase = await createClient();

  const [matchesRes, profilesRes] = await Promise.all([
    supabase.from("matches").select("team_a, team_b, winner_team").not("winner_team", "is", null),
    supabase.from("profiles").select("id, name, avatar_url").order("name"),
  ]);

  const matches  = matchesRes.data ?? [];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Build unique pair stats
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const pairStats: Record<string, { ids: [string, string]; wins: number; total: number }> = {};

  for (const m of matches) {
    const sides = [
      { ids: m.team_a as string[], won: m.winner_team === "a" },
      { ids: m.team_b as string[], won: m.winner_team === "b" },
    ];
    for (const { ids, won } of sides) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j]);
          if (!pairStats[key]) pairStats[key] = { ids: [ids[i], ids[j]], wins: 0, total: 0 };
          pairStats[key].total++;
          if (won) pairStats[key].wins++;
        }
      }
    }
  }

  const pairs: PairRow[] = Object.values(pairStats)
    .map((p) => ({
      ...p,
      profileA: profileMap.get(p.ids[0])!,
      profileB: profileMap.get(p.ids[1])!,
      losses:   p.total - p.wins,
      winRate:  p.total > 0 ? p.wins / p.total : 0,
    }))
    .filter((p) => p.profileA && p.profileB)
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="px-4 pt-8 pb-6">
      <div className="mb-5">
        <h1 className="text-2xl font-heading font-bold text-white">Partnerships</h1>
      </div>
      <PairsClient pairs={pairs} players={profiles} />
    </div>
  );
}
