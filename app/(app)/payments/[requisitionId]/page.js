import Link from "next/link";
import RoleChip from "@/components/RoleChip";
import BackLink from "@/components/BackLink";
import PaymentsTable from "@/components/PaymentsTable";
import { getCurrentEmployee } from "@/lib/currentUser";
import { fetchWorkerPaymentRows } from "@/lib/paymentsData";
import { saveWorkerPayments } from "@/lib/paymentActions";
import { redirect, notFound } from "next/navigation";

export default async function PaymentDetailPage({ params }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const { rows } = await fetchWorkerPaymentRows(params.requisitionId);
  if (rows.length === 0) notFound();

  const first = rows[0];
  const boundSaveAction = saveWorkerPayments.bind(null, employee.email);

  const csvRows = rows.map((r) => ({
    worker: r.worker_name,
    requisition_id: r.requisition_id,
    worker_type: r.worker_type,
    store: r.store_name,
    vendor: r.vendor_name || "Not assigned",
    days: r.effective_days,
    rate: r.rate_per_day ?? "",
    amount: r.amount ?? "",
    status: r.payment_status,
    remarks: r.payment_remarks || "",
  }));

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
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

      <PaymentsTable rows={rows} saveAction={boundSaveAction} csvRows={csvRows} />
    </div>
  );
}
