import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { PREVIEW_MODE } from "@/lib/mockData";

async function getActionCount(employee) {
  if (PREVIEW_MODE || !employee) return 0;

  const supabase = createSupabaseServerClient();

  if (employee.role === "hod") {
    const { count } = await supabase
      .from("requisitions")
      .select("id", { count: "exact", head: true })
      .eq("hod_email", employee.email)
      .eq("status", "pending_hod_approval");
    return count || 0;
  }

  if (employee.role === "hr" || employee.role === "admin") {
    const { count } = await supabase
      .from("requisitions")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .is("vendor_id", null);
    return count || 0;
  }

  return 0;
}

function bellHref(role) {
  if (role === "hod") return "/dashboard";
  if (role === "hr" || role === "admin") return "/dashboard";
  return "/dashboard";
}

export default async function Navbar({ employee }) {
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

  const actionCount = employee && ["hod", "hr", "admin"].includes(employee.role)
    ? await getActionCount(employee)
    : 0;

  return (
    <div className="navbar">
      <Link href="/dashboard" className="navbar-brand">
        <Image src="/fnp-logo.png" alt="FNP" width={70} height={38} priority style={{ height: 28, width: "auto" }} />
        <span>Adhoc Hiring</span>
      </Link>
      <div className="navbar-meta">
        {employee && actionCount > 0 && (
          <Link href={bellHref(employee.role)} className="bell-link" aria-label={`${actionCount} items need your attention`}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2a5 5 0 0 0-5 5v3.2c0 .5-.2 1-.5 1.4L3 13.5c-.6.7-.1 1.8.8 1.8h12.4c.9 0 1.4-1.1.8-1.8l-1.5-1.9c-.3-.4-.5-.9-.5-1.4V7a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="bell-badge">{actionCount > 9 ? "9+" : actionCount}</span>
          </Link>
        )}
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
