import Link from "next/link";
import Navbar from "@/components/Navbar";
import RoleChip from "@/components/RoleChip";
import StatusBadge from "@/components/StatusBadge";
import VendorAssignForm from "@/components/VendorAssignForm";
import DecisionForms from "./DecisionForms";
import { decideRequisition } from "./decisionActions";
import { assignVendor } from "@/lib/vendorActions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS, MOCK_EVENTS } from "@/lib/mockData";
import { notFound } from "next/navigation";

export default async function RequisitionDetailPage({ params }) {
  const { employee } = await getCurrentEmployee();

  // PREVIEW MODE: sample data instead of a real Supabase query — see
  // lib/mockData.js. Set PREVIEW_MODE = false there to restore these queries.
  let requisition, events, vendor, activeVendors;
  if (PREVIEW_MODE) {
    requisition = MOCK_REQUISITIONS.find((r) => r.requisition_id === params.requisitionId);
    events = MOCK_EVENTS[params.requisitionId] || [];
    vendor = null;
    activeVendors = [];
  } else {
    const supabase = createSupabaseServerClient();
    ({ data: requisition } = await supabase
      .from("requisitions")
      .select("*")
      .eq("requisition_id", params.requisitionId)
      .single());
    ({ data: events } = await supabase
      .from("requisition_events")
      .select("*")
      .eq("requisition_id", params.requisitionId)
      .order("created_at", { ascending: true }));

    if (requisition?.vendor_id) {
      ({ data: vendor } = await supabase
        .from("vendors")
        .select("name")
        .eq("id", requisition.vendor_id)
        .single());
    }

    if (employee && ["hr", "admin"].includes(employee.role) && requisition?.status === "approved" && !requisition.vendor_id) {
      ({ data: activeVendors } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("is_active", true)
        .order("name"));
    }
  }

  if (!requisition) notFound();

  const canDecide =
    employee?.role === "hod" &&
    employee.email === requisition.hod_email &&
    requisition.status === "pending_hod_approval";

  const canAssignVendor =
    employee &&
    ["hr", "admin"].includes(employee.role) &&
    requisition.status === "approved" &&
    !requisition.vendor_id;

  const approveAction = decideRequisition.bind(null, requisition.requisition_id, employee?.email, "approved");
  const rejectAction = decideRequisition.bind(null, requisition.requisition_id, employee?.email, "rejected");
  const vendorAction = assignVendor.bind(null, requisition.requisition_id, employee?.email);

  return (
    <>
      <Navbar employee={employee} />
      <div className="container" style={{ maxWidth: 640 }}>
        <span className="eyebrow">{requisition.requisition_id}</span>
        <div className="section-header">
          <h1>
            <RoleChip workerType={requisition.worker_type} /> requisition
          </h1>
          <StatusBadge status={requisition.status} />
        </div>

        {requisition.status === "approved" && (
          <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
            <Link href={`/requisitions/${requisition.requisition_id}/attendance`} className="btn btn-secondary">
              Mark attendance
            </Link>
          </div>
        )}

        {canDecide && <DecisionForms approveAction={approveAction} rejectAction={rejectAction} />}

        {canAssignVendor && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 4 }}>Assign a vendor</h2>
            <p className="hint" style={{ marginBottom: 14 }}>
              This requisition is approved but no vendor is supplying the headcount yet.
            </p>
            <VendorAssignForm action={vendorAction} vendors={activeVendors} />
          </div>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="profile-grid">
            <Field label="Number of workers" value={requisition.number_of_workers} />
            <Field label="Tentative rate" value={`₹${requisition.tentative_rate}/day`} />
            <Field label="From" value={formatDate(requisition.from_date)} />
            <Field label="To" value={formatDate(requisition.to_date)} />
            <Field label="Store" value={`${requisition.store_name || "-"} (${requisition.store_code || "-"})`} />
            <Field label="Cost center" value={requisition.cost_center || "-"} />
            <Field label="Raised by" value={requisition.raised_by_email} />
            <Field label="Approver (HOD)" value={requisition.hod_email || "-"} />
            {requisition.vendor_id && <Field label="Vendor" value={vendor?.name || "Assigned"} />}
          </div>
          {requisition.status === "rejected" && requisition.hod_remarks && (
            <p style={{ marginTop: 16 }}>
              <strong style={{ color: "var(--danger)" }}>HOD remarks:</strong> {requisition.hod_remarks}
            </p>
          )}
        </div>

        <h2 style={{ marginBottom: 12 }}>Activity</h2>
        <div className="card">
          {events && events.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {events.map((e) => (
                <li
                  key={e.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #EEF1ED",
                    fontSize: 13,
                  }}
                >
                  <strong>{eventLabel(e.event_type)}</strong>
                  {e.actor_email ? ` — ${e.actor_email}` : ""}
                  <span style={{ color: "var(--ink-faint)", marginLeft: 8 }}>
                    {new Date(e.created_at).toLocaleString("en-IN")}
                  </span>
                  {e.remarks && <div style={{ color: "var(--ink-muted)" }}>{e.remarks}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0 }}>No activity logged yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="profile-field">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function eventLabel(type) {
  return (
    {
      raised: "Requisition raised",
      hr_notified: "HR notified",
      hod_approved: "Approved by HOD",
      hod_rejected: "Rejected by HOD",
      vendor_assigned: "Vendor assigned",
      cancelled: "Cancelled",
    }[type] || type
  );
}
