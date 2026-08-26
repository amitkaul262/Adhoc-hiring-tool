import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Supabase redirects here after the user clicks the magic link.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
