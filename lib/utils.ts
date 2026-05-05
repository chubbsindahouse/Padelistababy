import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BadgeKey, BadgeMeta } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatWinRate(wins: number, played: number): string {
  if (played === 0) return "0%";
  return `${Math.round((wins / played) * 100)}%`;
}

export function eloColor(delta: number): string {
  if (delta > 0) return "text-green-600";
  if (delta < 0) return "text-red-500";
  return "text-gray-500";
}

// ─── Badge catalogue ──────────────────────────────────────────────────────────

export const BADGE_CATALOGUE: BadgeMeta[] = [
  {
    key: "first_blood",
    name: "First Blood",
    description: "Win your very first match in the app.",
    icon: "🩸",
  },
  {
    key: "hat_trick",
    name: "Hat Trick",
    description: "Win 3 consecutive games in a single Winner Stays On session.",
    icon: "🎩",
  },
  {
    key: "iron_man",
    name: "Iron Man",
    description: "Play the most games of any player in a single session.",
    icon: "🦾",
  },
  {
    key: "giant_killer",
    name: "Giant Killer",
    description: "Beat a pair whose combined ELO is at least 100 points higher than yours.",
    icon: "🗡️",
  },
  {
    key: "perfect_game",
    name: "Perfect Game",
    description: "Win a game 6–0.",
    icon: "💎",
  },
  {
    key: "come_back_kid",
    name: "Come Back Kid",
    description: "Win a match after losing the first game.",
    icon: "⚡",
  },
  {
    key: "century_club",
    name: "Century Club",
    description: "Play 100 total games across all sessions.",
    icon: "💯",
  },
  {
    key: "dynamic_duo",
    name: "Dynamic Duo",
    description: "Win 10 matches with the same partner.",
    icon: "🤝",
  },
  {
    key: "top_of_the_table",
    name: "Top of the Table",
    description: "Reach #1 on the leaderboard.",
    icon: "👑",
  },
  {
    key: "consistent",
    name: "Consistent",
    description: "Attend 10 sessions.",
    icon: "📅",
  },
  {
    key: "dominator",
    name: "Dominator",
    description: "Win every match in a single session (minimum 3 matches).",
    icon: "🔥",
  },
  {
    key: "upset_artist",
    name: "Upset Artist",
    description: "Win a match as the lower-ELO pair 5 times.",
    icon: "🎭",
  },
];

export function getBadgeMeta(key: BadgeKey): BadgeMeta {
  return BADGE_CATALOGUE.find((b) => b.key === key)!;
}
