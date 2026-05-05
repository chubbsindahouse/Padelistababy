import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { hashPassword } from "@/lib/player-auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, elo_rating, total_points, avatar_url")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, username, password } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const supabase = createServiceClient();

  // Create profile first (need the ID for hashing)
  const insert: Record<string, unknown> = { name: name.trim(), elo_rating: 1000, total_points: 0 };
  if (username?.trim()) insert.username = username.trim().toLowerCase();

  const { data, error } = await supabase
    .from("profiles").insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hash password if provided
  if (password && data) {
    const hash = await hashPassword(password, data.id);
    await supabase.from("profiles").update({ password_hash: hash }).eq("id", data.id);
  }

  return NextResponse.json(data, { status: 201 });
}
