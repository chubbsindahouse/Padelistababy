"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Trophy, BarChart2, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/home",        label: "Home",    Icon: Home },
  { href: "/sessions",    label: "Sessions", Icon: CalendarDays },
  { href: "/leaderboard", label: "Ranks",   Icon: Trophy },
  { href: "/stats",       label: "Stats",   Icon: BarChart2 },
  { href: "/profile",     label: "Profile", Icon: UserCircle },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="mx-3 mb-3 rounded-2xl glass-strong shadow-glass overflow-hidden">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-all duration-200",
                  active ? "text-cyan-400" : "text-slate-500"
                )}>
                {active && (
                  <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-cyan-400/10" />
                )}
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8}
                  className={cn("relative z-10 transition-all", active && "drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]")} />
                <span className="relative z-10 text-[10px] font-semibold tracking-wide">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
