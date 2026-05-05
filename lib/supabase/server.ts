import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon; // fallback to anon if not set

/** Standard client — anon key, for public reads */
export async function createClient() {
  return createSupabaseClient(url, anon);
}

/** Service-role client — bypasses RLS, use only in server-side admin routes */
export function createServiceClient() {
  return createSupabaseClient(url, svc, {
    auth: { persistSession: false },
  });
}
