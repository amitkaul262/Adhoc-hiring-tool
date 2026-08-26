import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export default function Navbar({ employee }) {
  async function signOut() {
    "use server";
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
