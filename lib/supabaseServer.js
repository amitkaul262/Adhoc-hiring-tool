import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client that reads/writes the auth cookie.
// Use this inside Server Components, Server Actions, and Route Handlers.
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component render — middleware handles refresh
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // same as above
          }
        },
      },
    }
  );
}

// Privileged client for server-only operations that must bypass RLS
// (e.g. looking up an employee record while routing a new requisition
// before the session cookie context is fully available). Never import
// this into anything that runs in the browser.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
