import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { PREVIEW_MODE } from "@/lib/mockData";

export default function Navbar({ employee }) {
  async function signOut() {
    "use server";
    // PREVIEW MODE: no real session to sign out of yet. Set PREVIEW_MODE =
    // false in lib/mockData.js once Supabase auth is wired up.
    if (PREVIEW_MODE) {
      redirect("/dashboard");
    }
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="navbar">
      <span className="navbar-brand">FNP Adhoc Hiring</span>
      <div className="navbar-meta">
        {employee && (
          <span>
            {employee.full_name} · {employee.store_name || employee.function}
          </span>
        )}
        <form action={signOut}>
          <button type="submit" className="link-btn">Sign out</button>
        </form>
      </div>
    </div>
  );
}
