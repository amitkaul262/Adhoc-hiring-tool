import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AdminVendorsPage() {
  const supabase = createSupabaseServerClient();
  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  return (
    <>
      <div className="section-header">
        <h2>Vendors</h2>
        <Link href="/admin/vendors/new" className="btn btn-primary">+ Add vendor</Link>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: vendors?.length ? "8px 16px" : 0 }}>
          {vendors && vendors.length > 0 ? (
            <div className="table-scroll">
            <table className="req-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="req-id">{v.name}</td>
                    <td>{v.contact_name || "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{v.contact_email || "-"}</td>
                    <td>{v.contact_phone || "-"}</td>
                    <td><span className={`pill ${v.is_active ? "pill-active" : "pill-inactive"}`}>{v.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <Link href={`/admin/vendors/${v.id}/edit`} style={{ fontSize: 13, color: "var(--primary)" }}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="queue-empty">No vendors added yet.</div>
          )}
        </div>
      </div>
    </>
  );
}
