"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "bot";
  text: string;
}

const SUGGESTIONS = [
  "Who's top of the leaderboard?",
  "Who has the best win rate?",
  "Which pair plays together most?",
  "How many sessions have we played?",
];

export function ChatBot() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function sendMessage(text: string) {
    const q = text.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      const answer = res.ok ? data.answer : (data.error ?? "Something went wrong.");
      setMessages((prev) => [...prev, { role: "bot", text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Couldn't reach the server. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat"
        className={cn(
          "fixed bottom-24 right-4 z-40 w-13 h-13 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
          open
            ? "bg-white/10 border border-white/20 text-slate-400 rotate-90 scale-95"
            : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-glow-cyan scale-100"
        )}
        style={{ width: 52, height: 52 }}
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      <div className={cn(
        "fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out",
        open ? "translate-y-0" : "translate-y-full"
      )}>
        {/* Backdrop tap-to-close */}
        {open && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setOpen(false)} />
        )}

        <div className="relative bg-[#0D0D18] border-t border-white/10 rounded-t-3xl shadow-2xl flex flex-col max-w-lg mx-auto"
          style={{ height: "72vh", maxHeight: 560 }}>

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-sm">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Padel Bot</p>
              <p className="text-[10px] text-slate-500">Ask me anything about stats</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="ml-auto w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="py-4 space-y-4">
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={13} className="text-cyan-400" />
                  </div>
                  <div className="glass-card rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                    <p className="text-sm text-slate-300">Hey! Ask me anything about your padel group — rankings, matches, player stats, badges, you name it.</p>
                  </div>
                </div>

                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2 pl-9">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 active:bg-cyan-500/10 active:border-cyan-500/20 active:text-cyan-400 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2.5", msg.role === "user" && "flex-row-reverse")}>
                {msg.role === "bot" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={13} className="text-cyan-400" />
                  </div>
                )}
                <div className={cn(
                  "rounded-2xl px-3.5 py-2.5 max-w-[80%] text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-tr-sm"
                    : "glass-card text-slate-300 rounded-tl-sm"
                )}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-cyan-400" />
                </div>
                <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-white/[0.06] shrink-0 pb-safe">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about stats, rankings…"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow-sm disabled:opacity-40 active:scale-95 transition-all shrink-0"
              >
                <Send size={15} className="text-white" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}
