import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const ROLE_LABELS = { store_manager: "Store Manager", hod: "HOD", hr: "HR", admin: "Admin" };

export default async function AdminPeoplePage() {
  const supabase = createSupabaseServerClient();
  const { data: people } = await supabase
    .from("employee_master")
    .select("*")
    .order("role")
    .order("full_name");

  return (
    <>
      <div className="section-header">
        <h2>People</h2>
        <Link href="/admin/people/new" className="btn btn-primary">+ Add person</Link>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: people?.length ? "8px 16px" : 0 }}>
          {people && people.length > 0 ? (
            <table className="req-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Store / Function</th>
                  <th>Reports to</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.email}>
                    <td>{p.full_name}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{p.email}</td>
                    <td><span className={`emp-role-badge emp-role-${p.role}`}>{ROLE_LABELS[p.role] || p.role}</span></td>
                    <td>{p.store_name || p.function || "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{p.reports_to_email || "-"}</td>
                    <td><span className={`pill ${p.is_active ? "pill-active" : "pill-inactive"}`}>{p.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <Link href={`/admin/people/${encodeURIComponent(p.email)}/edit`} style={{ fontSize: 13, color: "var(--primary)" }}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="queue-empty">No one added yet.</div>
          )}
        </div>
      </div>
    </>
  );
}
