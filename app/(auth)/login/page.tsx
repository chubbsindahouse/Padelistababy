"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, User, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "player" | "admin";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialTab   = (searchParams.get("tab") as Tab) ?? "player";
  const next         = searchParams.get("next") ?? "";

  const [tab,      setTab]      = useState<Tab>(initialTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = tab === "admin" ? "/api/auth/login" : "/api/auth/player-login";
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Incorrect username or password.");
        return;
      }
      const destination = next || (tab === "admin" ? "/admin" : "/profile");
      router.push(destination);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#05050A] flex flex-col items-center justify-center px-5 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      {/* Logo */}
      <div className="relative mb-8 text-center">
        <div className="relative w-48 h-48 mx-auto mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Padel by Chubbs" className="w-full h-full object-contain drop-shadow-[0_0_24px_rgba(34,211,238,0.25)]" />
        </div>
        <p className="text-slate-500 text-sm tracking-wide">Sign in to continue</p>
      </div>

      {/* Tab switcher */}
      <div className="w-full max-w-sm flex bg-white/5 rounded-xl p-1 mb-4">
        {(["player", "admin"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); }}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
              tab === t
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow-sm"
                : "text-slate-400"
            )}>
            {t === "player" ? "Player" : "Admin"}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-sm glass-card rounded-2xl p-6 shadow-glass">
        <div className="flex items-center gap-2 mb-6">
          {tab === "admin"
            ? <ShieldCheck size={18} className="text-cyan-400" />
            : <User size={18} className="text-cyan-400" />}
          <p className="text-sm font-bold text-white">
            {tab === "admin" ? "Admin Sign In" : "Player Sign In"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username"
              autoCapitalize="none"
              autoComplete="username"
              className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              autoComplete="current-password"
              className="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-glow-cyan disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>

      <p className="text-slate-700 text-xs mt-8 text-center px-4">
        {tab === "player"
          ? "Ask your admin to set up your login credentials."
          : "Admin-only access. Contact your group admin."}
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
