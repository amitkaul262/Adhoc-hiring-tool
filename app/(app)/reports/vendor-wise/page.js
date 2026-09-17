import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchVendorWiseReport } from "@/lib/vendorReportData";
import VendorWiseTable from "@/components/VendorWiseTable";
import BackLink from "@/components/BackLink";
import KpiStrip from "@/components/KpiStrip";
import ExportCsvButton from "@/components/ExportCsvButton";
import { redirect } from "next/navigation";

export default async function VendorWiseReportPage() {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const rows = await fetchVendorWiseReport();

  const totalVendors = rows.filter((r) => r.vendor_id).length;
  const totalAmount = rows.reduce((s, r) => s + r.total_amount, 0);
  const totalWorkers = rows.reduce((s, r) => s + r.worker_count, 0);
  const unassignedRow = rows.find((r) => !r.vendor_id);

  const csvRows = rows.map((r) => ({
    vendor: r.vendor_name,
    requisitions: r.requisition_count,
    workers: r.worker_count,
    days: r.total_days,
    gst_percentage: r.gst_percentage ?? "",
    base_amount: r.total_base_amount,
    gst_amount: r.total_gst_amount,
    total_amount: r.total_amount,
    paid_count: r.paid_count,
    partially_paid_count: r.partially_paid_count,
    pending_count: r.pending_count,
  }));

  return (
    <div className="container-wide">
      <BackLink href="/reports" label="Back to reports" />
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Payments by vendor</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        Every vendor's total exposure across every requisition they've supplied workers for — a
        requisition split across multiple vendors contributes its share to each one correctly.
      </p>

      <KpiStrip
        stats={[
          { label: "Vendors used", value: totalVendors },
          { label: "Total workers", value: totalWorkers },
          { label: "Total payable", value: `₹${totalAmount.toLocaleString("en-IN")}` },
          { label: "Unassigned workers", value: unassignedRow?.worker_count || 0 },
        ]}
      />

      <VendorWiseTable rows={rows} />

      <div style={{ marginTop: 16 }}>
        <ExportCsvButton
          filename="payments-by-vendor.csv"
          columns={[
            { key: "vendor", label: "Vendor" },
            { key: "requisitions", label: "Requisitions" },
            { key: "workers", label: "Workers" },
            { key: "days", label: "Total Days" },
            { key: "gst_percentage", label: "GST %" },
            { key: "base_amount", label: "Base Amount" },
            { key: "gst_amount", label: "GST Amount" },
            { key: "total_amount", label: "Total Amount" },
            { key: "paid_count", label: "Paid Workers" },
            { key: "partially_paid_count", label: "Partially Paid Workers" },
            { key: "pending_count", label: "Pending Workers" },
          ]}
          rows={csvRows}
          label="Export CSV"
        />
      </div>
    </div>
  );
}
