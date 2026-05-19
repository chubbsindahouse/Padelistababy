"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Camera, LogOut, ShieldCheck, Check, Eye, EyeOff } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { ProfileStats } from "@/components/profile/profile-stats";
import { cn } from "@/lib/utils";

interface PlayerProfile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  total_points: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile,    setProfile]    = useState<PlayerProfile | null>(null);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [loading,    setLoading]    = useState(true);

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [pwLoading,  setPwLoading]  = useState(false);
  const [pwError,    setPwError]    = useState<string | null>(null);
  const [pwSuccess,  setPwSuccess]  = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/player/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.role === "admin") { setIsAdmin(true); }
        else if (data.profile)    { setProfile(data.profile); }
        else                      { router.push("/login?tab=player"); }
      })
      .catch(() => router.push("/login?tab=player"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("Passwords don't match."); return; }
    if (newPw.length < 4)    { setPwError("Password must be at least 4 characters."); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/player/password", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const body = await res.json();
      if (!res.ok) { setPwError(body.error ?? "Failed to update password."); return; }
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } finally { setPwLoading(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/player/avatar", { method: "POST", body: fd });
      const body = await res.json();
      if (res.ok && profile) setProfile({ ...profile, avatar_url: body.avatarUrl });
    } finally { setAvatarUploading(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#05050A]">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#05050A]">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 px-4 pt-safe pb-28">
          <div className="flex items-center gap-3 py-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-sm">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold text-white">Admin Account</h1>
              <p className="text-xs text-slate-500">Full access</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:bg-red-500/20 transition-all">
              <LogOut size={13} /> Sign Out
            </button>
          </div>
          <button onClick={() => router.push("/admin")} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <ShieldCheck size={16} /> Go to Admin Panel
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#05050A]">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none" />
      <div className="relative z-10 px-4 pt-safe pb-28 space-y-5">

        <div className="flex items-center gap-3 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-xl text-slate-400 active:bg-white/5 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-white flex-1">My Profile</h1>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold active:bg-red-500/20 transition-all">
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-500/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/15 blur-xl" />
              <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-cyan-500/40 ring-offset-2 ring-offset-[#05050A]">
                {(avatarPreview ?? profile.avatar_url) ? (
                  <img src={avatarPreview ?? profile.avatar_url!} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <Avatar name={profile.name} avatarUrl={null} size="lg" />
                )}
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={avatarUploading} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-sm active:scale-95 transition-all disabled:opacity-50">
                {avatarUploading
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} className="text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <h2 className="text-xl font-heading font-black text-white">{profile.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">@{profile.username}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold">{profile.elo_rating} ELO</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">{profile.total_points} pts</span>
              </div>
            </div>
          </div>
        </div>

        <ProfileStats profileId={profile.id} eloRating={profile.elo_rating} />

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={16} className="text-cyan-400" />
            <p className="text-sm font-bold text-white">Change Password</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required placeholder="Current password" className="w-full px-4 py-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <input type={showPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="New password" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all" />
            <input type={showPw ? "text" : "password"} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required placeholder="Confirm new password" className={cn("w-full px-4 py-3 bg-white/5 border rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 transition-all", confirmPw && newPw !== confirmPw ? "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20" : "border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20")} />
            {pwError && (
              <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{pwError}</div>
            )}
            {pwSuccess && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <Check size={13} /> Password updated successfully.
              </div>
            )}
            <button type="submit" disabled={pwLoading || (!!confirmPw && newPw !== confirmPw)} className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              {pwLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Update Password"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
