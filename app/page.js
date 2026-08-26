import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE } from "@/lib/mockData";

export default async function Home() {
  // PREVIEW MODE: skip the auth check, go straight to the dashboard.
  if (PREVIEW_MODE) {
    redirect("/dashboard");
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
