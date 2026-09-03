import { Suspense } from "react";
import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchMasterReport } from "@/lib/reportsData";
import ReportsTable from "@/components/ReportsTable";
import PaymentsFilterBar from "@/components/PaymentsFilterBar";
import KpiStrip from "@/components/KpiStrip";
import ExportCsvButton from "@/components/ExportCsvButton";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

function fmtDateTime(v) {
  if (!v) return "";
  return new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

const PAYMENT_LABELS = { pending: "Pending", partially_paid: "Partial", paid: "Paid" };

export default async function ReportsPage({ searchParams }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  let rows = await fetchMasterReport();

  if (searchParams?.store) rows = rows.filter((r) => r.store_name === searchParams.store);
  if (searchParams?.vendor) rows = rows.filter((r) => r.vendor_name && searchParams.vendor === r.vendor_name);
  if (searchParams?.payment_status) rows = rows.filter((r) => r.payment_status === searchParams.payment_status);

  const supabase = createSupabaseServerClient();
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const stores = [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort();

  const totalRequisitions = rows.length;
  const totalAmount = rows.reduce((s, r) => s + r.total_amount, 0);
  const fullyPaidCount = rows.filter((r) => r.payment_status === "paid").length;
  const stillOpenCount = rows.filter((r) => r.decision === "Approved" && r.payment_status !== "paid").length;

  const csvRows = rows.map((r) => ({
    requisition_id: r.requisition_id,
    worker_type: r.worker_type,
    store: r.store_name,
    store_code: r.store_code || "",
    function: r.function || "",
    cost_center: r.cost_center || "",
    reason: r.reason || "",
    sanctioned_workers: r.number_of_workers,
    tentative_rate: r.tentative_rate,
    from_date: r.from_date,
    to_date: r.to_date,
    raised_by: r.raised_by_email,
    raised_at: fmtDateTime(r.raised_at),
    hod: r.hod_email || "",
    decision: r.decision,
    decided_at: fmtDateTime(r.decided_at),
    hod_remarks: r.hod_remarks || "",
    vendor: r.vendor_name || "",
    vendor_assigned_at: fmtDateTime(r.vendor_assigned_at),
    gst_percentage: r.gst_percentage ?? "",
    attendance_workers: r.attendance_worker_count,
    attendance_expected_cells: r.attendance_expected_cells,
    attendance_effective_days: r.attendance_effective_days,
    attendance_completed_at: fmtDateTime(r.attendance_completed_at),
    attendance_frozen: r.attendance_frozen ? "Yes" : "No",
    attendance_frozen_at: fmtDateTime(r.attendance_frozen_at),
    total_amount: r.total_amount,
    total_base_amount: r.total_base_amount,
    total_gst_amount: r.total_gst_amount,
    payment_status: r.payment_status ? PAYMENT_LABELS[r.payment_status] : "",
    fully_paid_at: fmtDateTime(r.fully_paid_at),
    invoice_number: r.invoice_number || "",
    invoice_file_url: r.invoice_file_url || "",
  }));

  const csvColumns = [
    { key: "requisition_id", label: "Requisition ID" },
    { key: "worker_type", label: "Worker Type" },
    { key: "store", label: "Store" },
    { key: "store_code", label: "Store Code" },
    { key: "function", label: "Function" },
    { key: "cost_center", label: "Cost Center" },
    { key: "reason", label: "Reason" },
    { key: "sanctioned_workers", label: "Sanctioned Workers" },
    { key: "tentative_rate", label: "Tentative Rate" },
    { key: "from_date", label: "From" },
    { key: "to_date", label: "To" },
    { key: "raised_by", label: "Raised By" },
    { key: "raised_at", label: "Raised At" },
    { key: "hod", label: "HOD" },
    { key: "decision", label: "Decision" },
    { key: "decided_at", label: "Decided At" },
    { key: "hod_remarks", label: "HOD Remarks" },
    { key: "vendor", label: "Vendor" },
    { key: "vendor_assigned_at", label: "Vendor Assigned At" },
    { key: "gst_percentage", label: "GST %" },
    { key: "attendance_workers", label: "Attendance: Workers" },
    { key: "attendance_expected_cells", label: "Attendance: Expected Cells" },
    { key: "attendance_effective_days", label: "Attendance: Effective Days" },
    { key: "attendance_completed_at", label: "Attendance Completed At" },
    { key: "attendance_frozen", label: "Attendance Frozen" },
    { key: "attendance_frozen_at", label: "Attendance Frozen At" },
    { key: "total_amount", label: "Total Amount" },
    { key: "total_base_amount", label: "Total Base Amount" },
    { key: "total_gst_amount", label: "Total GST Amount" },
    { key: "payment_status", label: "Payment Status" },
    { key: "fully_paid_at", label: "Fully Paid At" },
    { key: "invoice_number", label: "Invoice Number" },
    { key: "invoice_file_url", label: "Invoice File Link" },
  ];

  return (
    <div className="container-wide">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Reports</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        Every requisition, start to paid — raised, decided, vendor assigned, attendance completed,
        payment settled. This is the full audit trail as one exportable report, not just events.
      </p>

      <KpiStrip
        stats={[
          { label: "Total requisitions", value: totalRequisitions },
          { label: "Total amount", value: `₹${totalAmount.toLocaleString("en-IN")}` },
          { label: "Fully paid", value: fullyPaidCount },
          { label: "Approved, still open", value: stillOpenCount },
        ]}
      />

      <Suspense fallback={null}>
        <PaymentsFilterBar vendors={(vendors || []).map((v) => ({ id: v.name, name: v.name }))} stores={stores} />
      </Suspense>

      <ReportsTable rows={rows} />

      <div style={{ marginTop: 16 }}>
        <ExportCsvButton filename="requisition-master-report.csv" columns={csvColumns} rows={csvRows} label="Export full report (CSV)" />
      </div>
    </div>
  );
}
