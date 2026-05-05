import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlayerId } from "@/lib/player-auth";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const adminMode = await isAdmin();
  const playerId  = adminMode ? null : await getCurrentPlayerId();
  if (!adminMode && !playerId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file     = formData.get("avatar") as File | null;
  const targetId = (formData.get("playerId") as string | null) ?? playerId;

  if (!file || !targetId) {
    return NextResponse.json({ error: "File and player ID required" }, { status: 400 });
  }

  const ext    = file.name.split(".").pop() ?? "jpg";
  const path   = `${targetId}.${ext}`;
  const buffer = await file.arrayBuffer();

  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

  await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", targetId);
  return NextResponse.json({ ok: true, avatarUrl: publicUrl });
}
