import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Resolves the logged-in auth user to their employee_master row.
// This is how the app knows a login email's store, cost center,
// function, and role without asking them to re-enter anything.
export async function getCurrentEmployee() {
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
