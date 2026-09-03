import { Suspense } from "react";
import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchWorkerPaymentRows, summarizeByRequisition } from "@/lib/paymentsData";
import PaymentsFilterBar from "@/components/PaymentsFilterBar";
import PaymentsRequisitionTable from "@/components/PaymentsRequisitionTable";
import KpiStrip from "@/components/KpiStrip";
import ExportCsvButton from "@/components/ExportCsvButton";
import { redirect } from "next/navigation";

const STATUS_LABELS = { pending: "Pending", partially_paid: "Partial", paid: "Paid" };

export default async function PaymentsPage({ searchParams }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const { rows, vendors } = await fetchWorkerPaymentRows();
  let summary = summarizeByRequisition(rows);

  if (searchParams?.vendor) summary = summary.filter((r) => r.vendor_id === searchParams.vendor);
  if (searchParams?.payment_status) summary = summary.filter((r) => r.rollup_status === searchParams.payment_status);
  if (searchParams?.store) summary = summary.filter((r) => r.store_name === searchParams.store);

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.name }));
  const stores = [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort();

  const totalRequisitions = summary.length;
  const totalWorkers = summary.reduce((s, r) => s + r.worker_count, 0);
  const totalAmount = summary.reduce((s, r) => s + r.total_amount, 0);
  const pendingCount = summary.filter((r) => r.rollup_status === "pending").length;

  const csvRows = summary.map((r) => ({
    requisition_id: r.requisition_id,
    worker_type: r.worker_type,
    store: r.store_name,
    function: r.function || "",
    cost_center: r.cost_center || "",
    reason: r.reason || "",
    raised_by: r.raised_by_email || "",
    hod: r.hod_email || "",
    vendor: r.vendor_name || "Not assigned",
    gst_percentage: r.gst_percentage ?? 0,
    from_date: r.from_date,
    to_date: r.to_date,
    workers: r.worker_count,
    days: r.total_days,
    base_amount: Math.round((r.total_base_amount || 0) * 100) / 100,
    gst_amount: Math.round((r.total_gst_amount || 0) * 100) / 100,
    amount: r.total_amount,
    status: STATUS_LABELS[r.rollup_status],
    invoice_number: r.invoice_number || "",
  }));

  return (
    <div className="container-wide">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Payments</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        One line per requisition. Open a requisition to set each worker&apos;s rate, payment status, and remarks —
        the amount shown here is the total across everyone on that requisition.
      </p>

      <KpiStrip
        stats={[
          { label: "Requisitions", value: totalRequisitions },
          { label: "Total workers", value: totalWorkers },
          { label: "Total payable", value: `₹${totalAmount.toLocaleString("en-IN")}` },
          { label: "Fully pending", value: pendingCount },
        ]}
      />

      <Suspense fallback={null}>
        <PaymentsFilterBar vendors={vendorOptions} stores={stores} />
      </Suspense>

      <PaymentsRequisitionTable rows={summary} />

      <div style={{ marginTop: 16 }}>
        <ExportCsvButton
          filename="payments-by-requisition.csv"
          columns={[
            { key: "requisition_id", label: "Requisition ID" },
            { key: "worker_type", label: "Worker Type" },
            { key: "store", label: "Store" },
            { key: "function", label: "Function" },
            { key: "cost_center", label: "Cost Center" },
            { key: "reason", label: "Reason" },
            { key: "raised_by", label: "Raised By" },
            { key: "hod", label: "HOD" },
            { key: "vendor", label: "Vendor" },
            { key: "gst_percentage", label: "GST %" },
            { key: "from_date", label: "From" },
            { key: "to_date", label: "To" },
            { key: "workers", label: "Workers" },
            { key: "days", label: "Total Days" },
            { key: "base_amount", label: "Base Amount" },
            { key: "gst_amount", label: "GST Amount" },
            { key: "amount", label: "Total Amount" },
            { key: "status", label: "Status" },
            { key: "invoice_number", label: "Invoice Number" },
          ]}
          rows={csvRows}
        />
      </div>
    </div>
  );
}
