import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SessionCard } from "@/components/session/session-card";
import type { SessionWithPlayers, Profile } from "@/types";

export const revalidate = 30;

export default async function SessionsPage() {
  const supabase = await createClient();

  const [activeRes, pastRes] = await Promise.all([
    supabase.from("sessions").select("id, format, is_active, created_at")
      .eq("is_active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("sessions").select("id, date, format, is_active, winner_stays_on, session_players(player_id)")
      .eq("is_active", false).order("date", { ascending: false }).limit(20),
  ]);

  const activeSession = activeRes.data?.[0] ?? null;
  const pastSessions = pastRes.data ?? [];

  // Collect all unique player IDs across all sessions in one shot
  const allPlayerIds = [
    ...new Set(
      pastSessions.flatMap((s) =>
        (s.session_players as { player_id: string }[]).map((sp) => sp.player_id)
      )
    ),
  ];

  const { data: allPlayers } = allPlayerIds.length
    ? await supabase.from("profiles").select("id, name, avatar_url").in("id", allPlayerIds)
    : { data: [] };

  const playerMap = new Map((allPlayers ?? []).map((p) => [p.id, p as Profile]));

  const enriched: SessionWithPlayers[] = pastSessions.map((s) => {
    const playerIds = (s.session_players as { player_id: string }[]).map((sp) => sp.player_id);
    return { ...s, players: playerIds.map((id) => playerMap.get(id)).filter(Boolean) as Profile[] };
  });

  return (
    <div className="px-4 pt-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Sessions</h1>
          <p className="text-slate-500 text-sm mt-0.5">{enriched.length} recorded</p>
        </div>
        <Link
          href="/sessions/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold rounded-xl shadow-glow-sm"
        >
          <Plus size={15} />
          New
        </Link>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <Link href={`/sessions/${activeSession.id}`}
          className="block relative overflow-hidden rounded-2xl p-4">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/15" />
          <div className="absolute inset-0 border border-cyan-500/30 rounded-2xl" />
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-cyan-400/20 blur-2xl rounded-full" />
          <div className="relative flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Session in Progress</p>
              <p className="text-xs text-cyan-300/70 mt-0.5">
                {activeSession.format.toUpperCase()} · Tap to manage
              </p>
            </div>
          </div>
        </Link>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">History</p>
        {enriched.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <p className="text-5xl mb-4">🎾</p>
            <p className="text-sm font-semibold text-slate-500">No sessions yet</p>
            <p className="text-xs mt-1">Hit the court and start tracking!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enriched.map((s) => <SessionCard key={s.id} session={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
