import { redirect } from "next/navigation";

// Achievements are shown on individual player profile pages.
// Redirect to leaderboard as the default.
export default function AchievementsPage() {
  redirect("/leaderboard");
}
