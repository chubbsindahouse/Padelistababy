"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, Trash2, LogOut, Users, CalendarDays, RefreshCw, X, Check, Pencil, KeyRound, Eye, EyeOff } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";

type Tab = "players" | "sessions";

interface Player {
  id: string; name: string; username?: string | null;
  elo_rating: number; total_points: number; avatar_url?: string | null;
}
interface Session {
  id: string; date: string; format: string; is_active: boolean; winner_stays_on: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab,        setTab]        = useState<Tab>("players");
  const [players,    setPlayers]    = useState<Player[]>([]);
  const [sessions,   setSessions]   = useState<Session[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [isAdmin,    setIsAdmin]    = useState(false);

  // Add player
  const [newName,    setNewName]    = useState("");
  const [newUser,    setNewUser]    = useState("");
  const [newPass,    setNewPass]    = useState("");
  const [showNewPw,  setShowNewPw]  = useState(false);
  const [adding,     setAdding]     = useState(false);

  // Edit player name
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editName,   setEditName]   = useState("");

  // Reset password modal
  const [resetId,    setResetId]    = useState<string | null>(null);
  const [resetName,  setResetName]  = useState("");
  const [resetPw,    setResetPw]    = useState("");
  const [showReset,  setShowReset]  = useState(false);
  const [resetting,  setResetting]  = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/players")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        setIsAdmin(true);
        return r.json();
      })
      .then((data) => { if (data) setPlayers(data); })
      .finally(() => setLoading(false));
  }, [router]);

  const loadPlayers = useCallback(async () => {
    const r = await fetch("/api/admin/players");
    if (r.ok) setPlayers(await r.json());
  }, []);

  const loadSessions = useCallback(async () => {
    const r = await fetch("/api/admin/sessions-list");
    if (r.ok) setSessions(await r.json());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "sessions") loadSessions();
  }, [tab, isAdmin, loadSessions]);

  async function addPlayer() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     newName.trim(),
          username: newUser.trim() || undefined,
          password: newPass || undefined,
        }),
      });
      if (r.ok) { setNewName(""); setNewUser(""); setNewPass(""); await loadPlayers(); }
      else { const b = await r.json(); alert(b.error ?? "Failed to add player."); }
    } finally { setAdding(false); }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const r = await fetch(`/api/admin/players/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (r.ok) { setEditId(null); await loadPlayers(); }
    else alert("Failed to update player.");
  }

  async function deletePlayer(id: string, name: string) {
    if (!confirm(`Delete ${name}? This also removes their match and session records.`)) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/players/${id}`, { method: "DELETE" });
      await loadPlayers();
    } finally { setDeletingId(null); }
  }

  async function deleteSession(id: string) {
    if (!confirm("Delete this session and all its match data?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
      await loadSessions();
    } finally { setDeletingId(null); }
  }

  async function doResetPassword() {
    if (!resetPw || !resetId) return;
    setResetting(true);
    try {
      const r = await fetch(`/api/admin/players/${resetId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPw }),
      });
      if (r.ok) { setResetId(null); setResetPw(""); }
      else { const b = await r.json(); alert(b.error ?? "Failed to reset password."); }
    } finally { setResetting(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#05050A]">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
    </div>
  );
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#05050A]">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Reset password modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm glass-card rounded-2xl p-6 shadow-glass">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-white">Reset Password</p>
                <p className="text-xs text-slate-500 mt-0.5">{resetName}</p>
              </div>
              <button onClick={() => { setResetId(null); setResetPw(""); }}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                <X size={14} />
              </button>
            </div>
            <div className="relative mb-4">
              <input type={showReset ? "text" : "password"} value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="New password (min 4 chars)"
                autoFocus
                className="w-full px-4 py-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
              <button type="button" onClick={() => setShowReset(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showReset ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button onClick={doResetPassword} disabled={resetting || resetPw.length < 4}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              {resetting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><KeyRound size={14} /> Set Password</>}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 px-4 pt-safe">
        {/* Header */}
        <div className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-sm">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Admin Panel</h1>
              <p className="text-[11px] text-slate-500">Manage your padel group</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:bg-red-500/20 transition-all">
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-5">
          {([
            { key: "players",  label: "Players",  Icon: Users },
            { key: "sessions", label: "Sessions", Icon: CalendarDays },
          ] as { key: Tab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                tab === key
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-sm"
                  : "text-slate-400"
              )}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Players ── */}
        {tab === "players" && (
          <div className="space-y-4 pb-8">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Add Player</p>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Display name *"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={newUser} onChange={(e) => setNewUser(e.target.value)}
                  placeholder="Username"
                  autoCapitalize="none"
                  className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                <div className="relative">
                  <input type={showNewPw ? "text" : "password"} value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2.5 pr-9 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
                  <button type="button" onClick={() => setShowNewPw(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-600">Username + password let the player log in. Can be added later via Reset Password.</p>
              <button onClick={addPlayer} disabled={adding || !newName.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-glow-sm active:scale-95 transition-all">
                {adding
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Plus size={15} /> Add Player</>}
              </button>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                {players.length} Player{players.length !== 1 ? "s" : ""}
              </p>
              {players.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="text-sm font-semibold text-slate-500">No players yet</p>
                  <p className="text-xs mt-1">Add your first player above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p.id} className={cn("glass-card rounded-2xl p-4 transition-all", deletingId === p.id && "opacity-40")}>
                      {editId === p.id ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                          <input type="text" value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(p.id)}
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-cyan-500/40 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
                          <button onClick={() => saveEdit(p.id)}
                            className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 active:scale-95">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:scale-95">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{p.name}</p>
                            <p className="text-xs text-slate-500">
                              {p.username
                                ? <span className="text-cyan-600">@{p.username}</span>
                                : <span className="text-slate-600 italic">no login</span>}
                              {" · "}{p.elo_rating} ELO
                            </p>
                          </div>
                          <button onClick={() => { setEditId(p.id); setEditName(p.name); }}
                            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:scale-95 transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { setResetId(p.id); setResetName(p.name); setResetPw(""); }}
                            className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 active:scale-95 transition-all"
                            title="Reset password">
                            <KeyRound size={14} />
                          </button>
                          <button onClick={() => deletePlayer(p.id, p.name)} disabled={deletingId === p.id}
                            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 active:scale-95 transition-all disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Sessions ── */}
        {tab === "sessions" && (
          <div className="space-y-4 pb-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {sessions.length} Session{sessions.length !== 1 ? "s" : ""}
              </p>
              <button onClick={loadSessions}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 active:bg-white/10 transition-all">
                <RefreshCw size={14} />
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">🎾</p>
                <p className="text-sm font-semibold text-slate-500">No sessions yet</p>
                <p className="text-xs text-slate-600 mt-1">Start your first session from the Sessions tab.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className={cn("glass-card rounded-2xl p-4 flex items-center gap-3 transition-all", deletingId === s.id && "opacity-40")}>
                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.is_active ? "bg-cyan-400 animate-pulse" : "bg-slate-600")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">
                        {new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {s.is_active && <span className="ml-2 text-[10px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded-full">LIVE</span>}
                      </p>
                      <p className="text-xs text-slate-500">{s.format.toUpperCase()}{s.winner_stays_on ? " · WSO" : ""}</p>
                    </div>
                    <button onClick={() => deleteSession(s.id)} disabled={deletingId === s.id}
                      className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 active:scale-95 transition-all disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
