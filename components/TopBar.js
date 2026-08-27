import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import SearchTrigger from "@/components/SearchTrigger";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { PREVIEW_MODE } from "@/lib/mockData";

async function getActionItems(employee) {
  if (PREVIEW_MODE || !employee) return [];

  const supabase = createSupabaseServerClient();

  if (employee.role === "hod") {
    const { data } = await supabase
      .from("requisitions")
      .select("requisition_id, worker_type, store_name")
      .eq("hod_email", employee.email)
      .eq("status", "pending_hod_approval")
      .order("created_at", { ascending: true })
      .limit(6);
    return [
      {
        label: "Pending your approval",
        items: (data || []).map((r) => ({
          id: r.requisition_id,
          text: `${r.requisition_id} — ${r.worker_type}, ${r.store_name || "—"}`,
          href: `/requisitions/${r.requisition_id}`,
        })),
        moreHref: "/dashboard",
      },
    ];
  }

  if (employee.role === "hr" || employee.role === "admin") {
    const [{ data: needsVendor }, { count: pendingPayCount }] = await Promise.all([
      supabase
        .from("requisitions")
        .select("requisition_id, worker_type, store_name")
        .eq("status", "approved")
        .is("vendor_id", null)
        .order("created_at", { ascending: true })
        .limit(6),
      supabase
        .from("requisition_workers")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "pending"),
    ]);

    const groups = [];
    if ((needsVendor || []).length > 0) {
      groups.push({
        label: "Needs a vendor",
        items: needsVendor.map((r) => ({
          id: r.requisition_id,
          text: `${r.requisition_id} — ${r.worker_type}, ${r.store_name || "—"}`,
          href: `/requisitions/${r.requisition_id}`,
        })),
        moreHref: "/dashboard",
      });
    }
    if (pendingPayCount > 0) {
      groups.push({
        label: "Payment pending",
        items: [],
        count: pendingPayCount,
        moreHref: "/payments?payment_status=pending",
      });
    }
    return groups;
  }

  return [];
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

const ROLE_LABELS = { store_manager: "Store Manager", hod: "HOD", hr: "HR", admin: "Admin" };

export default async function TopBar({ employee }) {
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

  const actionGroups = employee && ["hod", "hr", "admin"].includes(employee.role)
    ? await getActionItems(employee)
    : [];
  const actionCount = actionGroups.reduce((sum, g) => sum + (g.count ?? g.items.length), 0);

  return (
    <div className="topbar">
      <Link href="/dashboard" className="topbar-brand">
        <img src="/fnp-logo.png" alt="FNP" style={{ height: 26, width: "auto" }} />
        <span className="topbar-divider" />
        <span>Adhoc Hiring</span>
      </Link>

      <div className="topbar-actions">
        {employee && <SearchTrigger />}
        {employee && actionCount > 0 && <NotificationBell groups={actionGroups} count={actionCount} />}

        {employee && (
          <div className="topbar-user">
            <span className="topbar-avatar">{initials(employee.full_name)}</span>
            <span className="topbar-user-text">
              <strong>{employee.full_name}</strong>
              <span>{ROLE_LABELS[employee.role] || employee.role} · {employee.store_name || employee.function || "—"}</span>
            </span>
          </div>
        )}

        <form action={signOut}>
          <button type="submit" className="topbar-signout" aria-label="Sign out" title="Sign out">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 14l4-4-4-4M17 10H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
