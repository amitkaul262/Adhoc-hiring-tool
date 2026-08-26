import RoleChip from "@/components/RoleChip";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";

const EVENT_LABELS = {
  raised: "Requisition raised",
  hr_notified: "HR notified",
  hod_approved: "Approved by HOD",
  hod_rejected: "Rejected by HOD",
  vendor_assigned: "Vendor assigned",
  reminder_sent: "Reminder sent",
  cancelled: "Cancelled",
};

export default async function AuditLogPage({ searchParams }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("requisition_events")
    .select("*, requisitions(worker_type, store_name, raised_by_email, hod_email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams?.event_type) query = query.eq("event_type", searchParams.event_type);
  if (searchParams?.actor) query = query.ilike("actor_email", `%${searchParams.actor}%`);

  const { data: events } = await query;

  return (
    <div className="container">
        <span className="eyebrow">HR</span>
        <div className="section-header">
          <h1>Audit log</h1>
        </div>
        <p style={{ marginBottom: 20 }}>
          Every action across every requisition, most recent first. Showing the last 200 events.
        </p>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: events?.length ? "8px 16px" : 0 }}>
            {events && events.length > 0 ? (
              <div className="table-scroll">
                <table className="req-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>Requisition</th>
                      <th>Role</th>
                      <th>Store</th>
                      <th>Actor</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                          {new Date(e.created_at).toLocaleString("en-IN")}
                        </td>
                        <td>{EVENT_LABELS[e.event_type] || e.event_type}</td>
                        <td>
                          <Link href={`/requisitions/${e.requisition_id}`} className="req-id">
                            {e.requisition_id}
                          </Link>
                        </td>
                        <td>{e.requisitions?.worker_type && <RoleChip workerType={e.requisitions.worker_type} />}</td>
                        <td>{e.requisitions?.store_name || "-"}</td>
                        <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{e.actor_email || "-"}</td>
                        <td style={{ fontSize: 12, color: "var(--ink-muted)", maxWidth: 220 }}>{e.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="queue-empty">No activity yet.</div>
            )}
          </div>
        </div>
    </div>
  );
}
