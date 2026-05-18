import Link from "next/link";
import { Plus, ChevronRight, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { formatRelativeDate } from "@/lib/utils";
import type { Profile, Session } from "@/types";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = await createClient();

  const [profilesRes, activeRes, lastRes, matchesRes, sessionsCountRes] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url, total_points").order("total_points", { ascending: false }),
    supabase.from("sessions").select("id, format").eq("is_active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("sessions").select("id, date, format, winner_stays_on").eq("is_active", false).order("date", { ascending: false }).limit(1),
    supabase.from("matches").select("id").not("winner_team", "is", null),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("is_active", false),
  ]);

  const profiles      = (profilesRes.data ?? []) as Profile[];
  const top3          = profiles.slice(0, 3);
  const activeSession = activeRes.data?.[0] ?? null;
  const lastSession   = lastRes.data?.[0] as Session | undefined;
  const totalMatches  = matchesRes.data?.length ?? 0;
  const totalPlayers  = profiles.length;
  const totalSessions = sessionsCountRes.count ?? 0;

  return (
    <div className="px-4 pt-8 space-y-5 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_home.png" alt="Padel by Chubbs" className="h-24 w-auto object-contain" />
        <Link href="/admin"
          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-400">
          Admin
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
                {activeSession.format.toUpperCase()} · Tap to view live scores
              </p>
            </div>
            <ChevronRight size={16} className="ml-auto text-cyan-400" />
          </div>
        </Link>
      )}

      {/* Quick start (visible to all, routes to admin area) */}
      {!activeSession && (
        <Link
          href="/sessions/new"
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan active:scale-[0.98] transition-all"
        >
          <Zap size={18} fill="white" />
          Start New Session
        </Link>
      )}

      {/* Group stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Players",  value: totalPlayers },
          { label: "Matches",  value: totalMatches },
          { label: "Sessions", value: totalSessions },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-heading font-black gradient-text">{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Last session */}
      {lastSession && (
        <Link href={`/sessions/${lastSession.id}`}
          className="glass-card rounded-2xl p-4 flex items-center gap-4 active:bg-white/[0.06] transition-colors">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">🎾</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Last Session</p>
            <p className="text-sm font-bold text-white mt-0.5">{formatRelativeDate(lastSession.date)}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {lastSession.format.toUpperCase()}{lastSession.winner_stays_on ? " · WSO" : ""}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-600" />
        </Link>
      )}

      {/* Leaderboard snapshot */}
      {top3.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-sm font-bold text-white">Leaderboard</p>
            <Link href="/leaderboard" className="text-xs text-cyan-400 font-semibold">See all →</Link>
          </div>
          {top3.map((p: Profile, i) => (
            <Link key={p.id} href={`/profile/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 active:bg-white/[0.03]">
              <span className="text-base w-6 text-center shrink-0">{["🥇", "🥈", "🥉"][i]}</span>
              <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
              <span className="text-sm text-white flex-1 font-medium">{p.name}</span>
              <span className="text-sm font-bold gradient-text">{p.total_points}</span>
              <span className="text-xs text-slate-600">pts</span>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {profiles.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-5xl mb-4">🎾</p>
          <p className="text-sm font-semibold text-slate-500">No players yet</p>
          <p className="text-xs mt-1">Go to Admin to add players and start tracking!</p>
          <Link href="/admin"
            className="inline-flex mt-4 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-semibold">
            Open Admin
          </Link>
        </div>
      )}

      <div className="h-2" />
    </div>
  );
}
