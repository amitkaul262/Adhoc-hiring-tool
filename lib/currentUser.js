import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_EMPLOYEE } from "@/lib/mockData";

// Resolves the logged-in auth user to their employee_master row.
// This is how the app knows a login email's store, cost center,
// function, and role without asking them to re-enter anything.
export async function getCurrentEmployee() {
  // PREVIEW MODE: skip real auth/Supabase entirely so the UI can be
  // reviewed before Google sign-in + Supabase are wired up. Remove this
  // block (and set PREVIEW_MODE = false in lib/mockData.js) to go live.
  if (PREVIEW_MODE) {
    return { user: { email: MOCK_EMPLOYEE.email }, employee: MOCK_EMPLOYEE };
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: employee, error } = await supabase
    .from("employee_master")
    .select("*")
    .eq("email", user.email)
    .eq("is_active", true)
    .single();

  if (error || !employee) {
    // Authenticated with Supabase, but no matching employee_master
    // record (or it's inactive) — they're not provisioned yet.
    return { user, employee: null };
  }

  return { user, employee };
}
