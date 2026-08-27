import Link from "next/link";
import RoleChip from "@/components/RoleChip";
import BackLink from "@/components/BackLink";
import PaymentsTable from "@/components/PaymentsTable";
import InvoiceForm from "@/components/InvoiceForm";
import AttachmentLink from "@/components/AttachmentLink";
import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchWorkerPaymentRows } from "@/lib/paymentsData";
import { saveWorkerPayments, saveInvoiceInfo, uploadInvoiceFile } from "@/lib/paymentActions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect, notFound } from "next/navigation";

export default async function PaymentDetailPage({ params }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const { rows } = await fetchWorkerPaymentRows(params.requisitionId);
  if (rows.length === 0) notFound();

  const supabase = createSupabaseServerClient();
  const { data: requisition } = await supabase
    .from("requisitions")
    .select("invoice_number, invoice_file_url")
    .eq("requisition_id", params.requisitionId)
    .single();

  const first = rows[0];
  const boundSaveAction = saveWorkerPayments.bind(null, employee.email);
  const boundInvoiceAction = saveInvoiceInfo.bind(null, params.requisitionId, employee.email);
  const boundUploadAction = uploadInvoiceFile.bind(null, params.requisitionId, employee.email);

  const csvRows = rows.map((r) => ({
    worker: r.worker_name,
    requisition_id: r.requisition_id,
    worker_type: r.worker_type,
    store: r.store_name,
    function: r.function || "",
    cost_center: r.cost_center || "",
    reason: r.reason || "",
    raised_by: r.raised_by_email || "",
    hod: r.hod_email || "",
    vendor: r.vendor_name || "Not assigned",
    from_date: r.from_date,
    to_date: r.to_date,
    full_days: r.full_days,
    half_days: r.half_days,
    absent_days: r.absent_days,
    leave_days: r.leave_days,
    effective_days: r.effective_days,
    rate: r.rate_per_day ?? "",
    amount: r.amount ?? "",
    status: r.payment_status,
    paid_at: r.paid_at ? new Date(r.paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
    remarks: r.payment_remarks || "",
    invoice_number: r.invoice_number || "",
  }));

  const csvColumns = [
    { key: "worker", label: "Worker" },
    { key: "requisition_id", label: "Requisition ID" },
    { key: "worker_type", label: "Worker Type" },
    { key: "store", label: "Store" },
    { key: "function", label: "Function" },
    { key: "cost_center", label: "Cost Center" },
    { key: "reason", label: "Reason" },
    { key: "raised_by", label: "Raised By" },
    { key: "hod", label: "HOD" },
    { key: "vendor", label: "Vendor" },
    { key: "from_date", label: "From" },
    { key: "to_date", label: "To" },
    { key: "full_days", label: "Full Days" },
    { key: "half_days", label: "Half Days" },
    { key: "absent_days", label: "Absent Days" },
    { key: "leave_days", label: "Leave Days" },
    { key: "effective_days", label: "Effective Days" },
    { key: "rate", label: "Rate/Day" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Payment Status" },
    { key: "paid_at", label: "Paid At" },
    { key: "remarks", label: "Remarks" },
    { key: "invoice_number", label: "Invoice Number" },
  ];

  return (
    <div className="container-wide">
      <BackLink href="/payments" label="Back to payments" />
      <span className="eyebrow">{first.requisition_id}</span>
      <div className="section-header">
        <h1>
          <RoleChip workerType={first.worker_type} /> payment detail
        </h1>
        <Link href={`/requisitions/${first.requisition_id}`} className="btn btn-secondary">
          View requisition
        </Link>
      </div>
      <p style={{ marginBottom: 20 }}>
        {first.store_name} · {first.vendor_name || "No vendor assigned"} · {rows.length} worker{rows.length > 1 ? "s" : ""}
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Vendor invoice</h2>
        {requisition?.invoice_file_url && (
          <p style={{ marginTop: 0, marginBottom: 14 }}>
            <AttachmentLink url={requisition.invoice_file_url} />
          </p>
        )}
        <InvoiceForm saveAction={boundInvoiceAction} uploadAction={boundUploadAction} initial={requisition} />
      </div>

      <PaymentsTable rows={rows} saveAction={boundSaveAction} csvRows={csvRows} csvColumns={csvColumns} />
    </div>
  );
}
