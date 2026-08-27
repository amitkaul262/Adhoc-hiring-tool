import Link from "next/link";
import RoleChip from "@/components/RoleChip";
import StatusBadge from "@/components/StatusBadge";
import VendorAssignForm from "@/components/VendorAssignForm";
import DecisionForms from "./DecisionForms";
import { decideRequisition } from "./decisionActions";
import { assignVendor } from "@/lib/vendorActions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchWorkerPaymentRows, summarizeByRequisition } from "@/lib/paymentsData";
import { totalDaysInclusive } from "@/lib/businessDays";
import { PREVIEW_MODE, MOCK_REQUISITIONS, MOCK_EVENTS } from "@/lib/mockData";
import { notFound } from "next/navigation";

export default async function RequisitionDetailPage({ params }) {
  const { employee } = await getCurrentEmployee();

  // PREVIEW MODE: sample data instead of a real Supabase query — see
  // lib/mockData.js. Set PREVIEW_MODE = false there to restore these queries.
  let requisition, events, vendor, activeVendors, attendanceSummary, paymentSummary;
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

    // Attendance + payment summaries — this is what makes this page a
    // genuine single-view "homepage" for the requisition, rather than
    // just a set of links out to other pages.
    const canSeeSummaries =
      employee &&
      requisition?.status === "approved" &&
      (requisition.raised_by_email === employee.email || ["hr", "admin"].includes(employee.role));

    if (canSeeSummaries) {
      const [{ count: workerCount }, { count: markedCells }] = await Promise.all([
        supabase.from("requisition_workers").select("id", { count: "exact", head: true }).eq("requisition_id", params.requisitionId),
        supabase.from("requisition_attendance").select("id", { count: "exact", head: true }).eq("requisition_id", params.requisitionId).not("status", "is", null),
      ]);
      const expectedCells = (workerCount || 0) * totalDaysInclusive(requisition.from_date, requisition.to_date);
      attendanceSummary = {
        workerCount: workerCount || 0,
        markedCells: markedCells || 0,
        expectedCells,
        complete: expectedCells > 0 && (markedCells || 0) >= expectedCells,
      };
    }

    // Payment summary is HR/admin only — rates negotiated with vendors
    // aren't shown to the store manager or HOD here.
    if (employee && ["hr", "admin"].includes(employee.role) && requisition?.status === "approved") {
      const { rows: paymentRows } = await fetchWorkerPaymentRows(params.requisitionId);
      const rollup = summarizeByRequisition(paymentRows)[0];
      paymentSummary = rollup || null;
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

  const canCloneRequisition =
    employee?.role === "store_manager" && employee.email === requisition.raised_by_email;

  const cloneUrl = `/requisitions/new?type=${encodeURIComponent(requisition.worker_type)}&count=${requisition.number_of_workers}&rate=${requisition.tentative_rate}&reason=${encodeURIComponent(requisition.reason || "")}`;

  const approveAction = decideRequisition.bind(null, requisition.requisition_id, employee?.email, "approved");
  const rejectAction = decideRequisition.bind(null, requisition.requisition_id, employee?.email, "rejected");
  const vendorAction = assignVendor.bind(null, requisition.requisition_id, employee?.email);

  return (
    <div className="container" style={{ maxWidth: 640 }}>
        <span className="eyebrow">{requisition.requisition_id}</span>
        <div className="section-header">
          <h1>
            <RoleChip workerType={requisition.worker_type} /> requisition
          </h1>
          <StatusBadge status={requisition.status} />
        </div>

        {(requisition.status === "approved" || canCloneRequisition) && (
          <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {requisition.status === "approved" && (
              <Link href={`/requisitions/${requisition.requisition_id}/attendance`} className="btn btn-secondary">
                Mark attendance
              </Link>
            )}
            {canCloneRequisition && (
              <Link href={cloneUrl} className="btn btn-secondary">
                Raise similar
              </Link>
            )}
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

        {(attendanceSummary || paymentSummary) && (
          <div className={attendanceSummary && paymentSummary ? "summary-grid" : ""} style={{ marginBottom: 24 }}>
            {attendanceSummary && (
              <div className="card">
                <div className="section-header" style={{ marginBottom: 10 }}>
                  <h2 style={{ fontSize: 16 }}>Attendance</h2>
                  <Link href={`/requisitions/${requisition.requisition_id}/attendance`} style={{ fontSize: 13, color: "var(--primary)" }}>
                    Open register →
                  </Link>
                </div>
                <p style={{ margin: 0, fontSize: 14 }}>
                  <strong>{attendanceSummary.markedCells}</strong> of {attendanceSummary.expectedCells} cells marked
                  {" "}({attendanceSummary.workerCount} worker{attendanceSummary.workerCount === 1 ? "" : "s"})
                </p>
                <span className={`pill ${requisition.attendance_frozen ? "pill-inactive-warn" : attendanceSummary.complete ? "pill-active" : "pill-inactive"}`} style={{ marginTop: 8, display: "inline-block" }}>
                  {requisition.attendance_frozen ? "Locked" : attendanceSummary.complete ? "Complete" : attendanceSummary.markedCells === 0 ? "Not started" : "In progress"}
                </span>
              </div>
            )}
            {paymentSummary && (
              <div className="card">
                <div className="section-header" style={{ marginBottom: 10 }}>
                  <h2 style={{ fontSize: 16 }}>Payment</h2>
                  <Link href={`/payments/${requisition.requisition_id}`} style={{ fontSize: 13, color: "var(--primary)" }}>
                    Open payments →
                  </Link>
                </div>
                <p style={{ margin: 0, fontSize: 14 }}>
                  <strong>₹{paymentSummary.total_amount.toLocaleString("en-IN")}</strong> total
                  {paymentSummary.rate_missing_count > 0 && (
                    <span style={{ color: "var(--warn)", fontSize: 12 }}> ({paymentSummary.rate_missing_count} unrated)</span>
                  )}
                </p>
                <span className={`pill ${paymentSummary.rollup_status === "paid" ? "pill-active" : paymentSummary.rollup_status === "pending" ? "pill-inactive" : "pill"}`} style={{ marginTop: 8, display: "inline-block" }}>
                  {paymentSummary.rollup_status === "paid" ? "Paid" : paymentSummary.rollup_status === "pending" ? "Pending" : "Partial"}
                </span>
                {requisition.invoice_number && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-muted)" }}>Invoice: {requisition.invoice_number}</p>
                )}
              </div>
            )}
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
            <Field label="Reason" value={requisition.reason === "Other" ? (requisition.reason_other || "Other") : (requisition.reason || "-")} />
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
                    {new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
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
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function eventLabel(type) {
  return (
    {
      raised: "Requisition raised",
      hr_notified: "HR notified",
      hod_approved: "Approved by HOD",
      hod_rejected: "Rejected by HOD",
      vendor_assigned: "Vendor assigned",
      reminder_sent: "Reminder sent",
      attendance_frozen: "Attendance register locked",
      attendance_unfrozen: "Attendance register unlocked",
      cancelled: "Cancelled",
    }[type] || type
  );
}
