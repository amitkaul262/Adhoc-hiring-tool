import { Suspense } from "react";
import Link from "next/link";
import HrRequisitionsTable from "@/components/HrRequisitionsTable";
import FilterBar from "@/components/FilterBar";
import KpiStrip from "@/components/KpiStrip";
import ExportCsvButton from "@/components/ExportCsvButton";
import { assignVendor } from "@/lib/vendorActions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
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
  let all = [], activeVendors = [], vendorsById = {};

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
            showVendorColumn
          />
        </div>
      </div>
    </div>
  );
}
