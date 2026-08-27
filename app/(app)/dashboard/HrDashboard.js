import { Suspense } from "react";
import Link from "next/link";
import HrRequisitionsTable from "@/components/HrRequisitionsTable";
import FilterBar from "@/components/FilterBar";
import KpiStrip from "@/components/KpiStrip";
import ExportCsvButton from "@/components/ExportCsvButton";
import { assignVendor } from "@/lib/vendorActions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchWorkerPaymentRows, summarizeByRequisition } from "@/lib/paymentsData";
import { totalDaysInclusive } from "@/lib/businessDays";
import { PREVIEW_MODE, MOCK_REQUISITIONS } from "@/lib/mockData";

const CSV_COLUMNS = [
  { key: "requisition_id", label: "Requisition ID" },
  { key: "worker_type", label: "Worker Type" },
  { key: "reason_display", label: "Reason" },
  { key: "number_of_workers", label: "Workers" },
  { key: "tentative_rate", label: "Rate/day" },
  { key: "store_name", label: "Store" },
  { key: "function", label: "Function" },
  { key: "status", label: "Status" },
  { key: "raised_by_email", label: "Raised By" },
  { key: "hod_email", label: "HOD" },
  { key: "from_date", label: "From" },
  { key: "to_date", label: "To" },
];

function applyFilters(rows, params) {
  return rows.filter((r) => {
    if (params?.status && r.status !== params.status) return false;
    if (params?.worker_type && r.worker_type !== params.worker_type) return false;
    if (params?.reason && r.reason !== params.reason) return false;
    if (params?.store && r.store_name !== params.store) return false;
    if (params?.function && r.function !== params.function) return false;
    if (params?.from && r.from_date < params.from) return false;
    if (params?.to && r.to_date > params.to) return false;
    return true;
  });
}

export default async function HrDashboard({ employee, searchParams }) {
  let all = [], activeVendors = [], vendorsById = {}, statusByReqId = {};

  if (PREVIEW_MODE) {
    // Preview mode was built around the store manager flow — showing the
    // same sample data here keeps the layout reviewable, but vendor
    // assignment is disabled the same way "raise requisition" is.
    all = MOCK_REQUISITIONS;
  } else {
    const supabase = createSupabaseServerClient();
    const [{ data: reqs }, { data: vendors }] = await Promise.all([
      supabase.from("requisitions").select("*").order("created_at", { ascending: false }),
      supabase.from("vendors").select("id, name, is_active").order("name"),
    ]);
    all = reqs || [];
    activeVendors = (vendors || []).filter((v) => v.is_active);
    vendorsById = Object.fromEntries((vendors || []).map((v) => [v.id, v]));

    // Attendance + payment status per approved requisition, for the two
    // extra columns in the main table below — this is what makes the
    // dashboard itself a full view, not just a launchpad to other pages.
    const approvedIds = all.filter((r) => r.status === "approved").map((r) => r.requisition_id);
    if (approvedIds.length > 0) {
      const [{ data: workerCounts }, { data: markedCounts }, { rows: paymentRows }] = await Promise.all([
        supabase.from("requisition_workers").select("requisition_id").in("requisition_id", approvedIds),
        supabase.from("requisition_attendance").select("requisition_id").in("requisition_id", approvedIds).not("status", "is", null),
        fetchWorkerPaymentRows(),
      ]);

      const workersByReq = {};
      for (const w of workerCounts || []) workersByReq[w.requisition_id] = (workersByReq[w.requisition_id] || 0) + 1;
      const markedByReq = {};
      for (const m of markedCounts || []) markedByReq[m.requisition_id] = (markedByReq[m.requisition_id] || 0) + 1;
      const paymentByReq = Object.fromEntries(summarizeByRequisition(paymentRows).map((p) => [p.requisition_id, p]));

      for (const r of all) {
        if (r.status !== "approved") continue;
        const workerCount = workersByReq[r.requisition_id] || 0;
        const expectedCells = workerCount * totalDaysInclusive(r.from_date, r.to_date);
        const markedCells = markedByReq[r.requisition_id] || 0;
        statusByReqId[r.requisition_id] = {
          attendance: r.attendance_frozen
            ? { label: "Locked", cls: "pill-inactive-warn" }
            : expectedCells > 0 && markedCells >= expectedCells
              ? { label: "Complete", cls: "pill-active" }
              : markedCells === 0
                ? { label: "Not started", cls: "pill-inactive" }
                : { label: "In progress", cls: "pill" },
          payment: paymentByReq[r.requisition_id]
            ? {
                label: paymentByReq[r.requisition_id].rollup_status === "paid" ? "Paid" : paymentByReq[r.requisition_id].rollup_status === "pending" ? "Pending" : "Partial",
                cls: paymentByReq[r.requisition_id].rollup_status === "paid" ? "pill-active" : paymentByReq[r.requisition_id].rollup_status === "pending" ? "pill-inactive" : "pill",
              }
            : { label: "—", cls: "pill-inactive" },
        };
      }
    }
  }

  const filtered = applyFilters(all, searchParams);
  const needsVendor = filtered.filter((r) => r.status === "approved" && !r.vendor_id);
  const rest = filtered.filter((r) => !(r.status === "approved" && !r.vendor_id));

  const stores = [...new Set(all.map((r) => r.store_name).filter(Boolean))].sort();
  const functions = [...new Set(all.map((r) => r.function).filter(Boolean))].sort();

  const pendingCount = all.filter((r) => r.status === "pending_hod_approval").length;
  const approvedCount = all.filter((r) => r.status === "approved").length;
  const rejectedCount = all.filter((r) => r.status === "rejected").length;

  return (
    <div className="container">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>{employee.full_name}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/audit" className="btn btn-secondary">Audit log</Link>
          <Link href="/payments" className="btn btn-secondary">Payments</Link>
          <Link href="/reports" className="btn btn-secondary">Reports</Link>
          {employee.role === "admin" && (
            <Link href="/admin/people" className="btn btn-secondary">Admin panel</Link>
          )}
        </div>
      </div>

      <KpiStrip
        stats={[
          { label: "Total requisitions", value: all.length },
          { label: "Pending approval", value: pendingCount },
          { label: "Approved", value: approvedCount },
          { label: "Needs a vendor", value: needsVendor.length },
        ]}
      />

      <Suspense fallback={null}>
        <FilterBar stores={stores} functions={functions} />
      </Suspense>

      <div className="section-header">
        <h2>Needs a vendor {needsVendor.length > 0 && `(${needsVendor.length})`}</h2>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        <div style={{ padding: needsVendor.length ? "8px 16px" : 0 }}>
          <HrRequisitionsTable
            requisitions={needsVendor}
            vendorsById={vendorsById}
            activeVendors={activeVendors}
            assignActionFor={(id) => assignVendor.bind(null, id, employee.email)}
            statusByReqId={statusByReqId}
            showVendorColumn
          />
        </div>
      </div>

      <div className="section-header">
        <h2>All requisitions</h2>
        <ExportCsvButton
          filename="requisitions.csv"
          columns={CSV_COLUMNS}
          rows={filtered.map((r) => ({
            ...r,
            reason_display: r.reason === "Other" ? r.reason_other || "Other" : r.reason || "",
          }))}
        />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: rest.length ? "8px 16px" : 0 }}>
          <HrRequisitionsTable
            requisitions={rest}
            vendorsById={vendorsById}
            statusByReqId={statusByReqId}
            showVendorColumn
          />
        </div>
      </div>
    </div>
  );
}
