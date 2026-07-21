/**
 * One-time ELO correction script.
 *
 * Run from the project root:
 *   node scripts/fix-elos.mjs
 *
 * What it does:
 *   Corrects the 4 profiles whose ELO was contaminated by a test session
 *   that was deleted while still active (so the ELO rollback was skipped).
 *
 * Verified correct values re-computed from scratch using all 12 matches
 * of Session 1 (Saturday 11 July 2026) with the app's own ELO formula.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gcjpnuwnbwnthdybnfnj.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjanBudXduYndudGhkeWJuZm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg4MjgyNCwiZXhwIjoyMDkzNDU4ODI0fQ.wxy8OQwpSdxsiUmJVeslsE7DH5WwwxanNeo8VyHkAwE";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Corrections: name → correct ELO
const CORRECTIONS = [
  { name: "Chubbs",     elo: 1032 },
  { name: "Musa",       elo: 1006 },
  { name: "Ali Abbas",  elo: 991  },
  { name: "Muaaz",      elo: 1023 },
];

async function main() {
  console.log("Fetching current profiles...\n");

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, elo_rating")
    .in("name", CORRECTIONS.map((c) => c.name));

  if (error) {
    console.error("Failed to fetch profiles:", error.message);
    process.exit(1);
  }

  console.log("Current state:");
  for (const p of profiles) {
    const fix = CORRECTIONS.find((c) => c.name === p.name);
    const diff = fix ? fix.elo - p.elo_rating : 0;
    console.log(
      `  ${p.name.padEnd(12)} ELO=${p.elo_rating}  →  ${fix?.elo ?? "(no change)"}  (${diff >= 0 ? "+" : ""}${diff})`
    );
  }

  console.log("\nApplying corrections...");

  for (const correction of CORRECTIONS) {
    const profile = profiles.find((p) => p.name === correction.name);
    if (!profile) {
      console.warn(`  ⚠ Player "${correction.name}" not found — skipping`);
      continue;
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ elo_rating: correction.elo })
      .eq("id", profile.id);

    if (updateError) {
      console.error(`  ✗ Failed to update ${correction.name}:`, updateError.message);
    } else {
      console.log(`  ✓ ${correction.name}: ${profile.elo_rating} → ${correction.elo}`);
    }
  }

  // Verify
  console.log("\nVerifying final state...");
  const { data: final } = await admin
    .from("profiles")
    .select("name, elo_rating, total_points")
    .order("total_points", { ascending: false })
    .order("elo_rating", { ascending: false });

  console.log("\n  Player          ELO    Pts");
  console.log("  " + "-".repeat(30));
  for (const p of final ?? []) {
    console.log(`  ${p.name.padEnd(14)}  ${String(p.elo_rating).padStart(4)}   ${p.total_points}`);
  }

  console.log("\nDone.");
}

main();
