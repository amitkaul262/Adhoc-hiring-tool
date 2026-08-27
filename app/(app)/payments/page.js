import { Suspense } from "react";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { saveWorkerPayments } from "@/lib/paymentActions";
import PaymentsFilterBar from "@/components/PaymentsFilterBar";
import PaymentsTable from "@/components/PaymentsTable";
import KpiStrip from "@/components/KpiStrip";
import { redirect } from "next/navigation";

const EFFECTIVE_DAYS = { full_day: 1, half_day: 0.5, absent: 0, leave: 0 };

export default async function PaymentsPage({ searchParams }) {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const supabase = createSupabaseServerClient();

  const [{ data: workers }, { data: vendors }, { data: attendanceRows }] = await Promise.all([
    supabase
      .from("requisition_workers")
      .select("*, requisitions(worker_type, store_name, function, vendor_id, from_date, to_date, status, tentative_rate)")
      .order("created_at", { ascending: false }),
    supabase.from("vendors").select("id, name"),
    supabase.from("requisition_attendance").select("requisition_worker_id, status").not("status", "is", null),
  ]);

  const vendorNameById = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]));

  const daysByWorker = {};
  for (const row of attendanceRows || []) {
    daysByWorker[row.requisition_worker_id] = (daysByWorker[row.requisition_worker_id] || 0) + (EFFECTIVE_DAYS[row.status] ?? 0);
  }

  // Only workers whose parent requisition is approved matter here — worker
  // slots only ever get created for approved requisitions in the first
  // place (see the attendance page), but this guards against edge cases
  // like a requisition somehow being reverted after slots existed.
  let rows = (workers || [])
    .filter((w) => w.requisitions?.status === "approved")
    .map((w) => {
      const effectiveDays = daysByWorker[w.id] || 0;
      const vendorName = w.requisitions.vendor_id ? vendorNameById[w.requisitions.vendor_id] || "Unknown vendor" : null;
      return {
        id: w.id,
        requisition_id: w.requisition_id,
        worker_name: w.worker_name || `Worker ${w.slot_number}`,
        worker_type: w.requisitions.worker_type,
        store_name: w.requisitions.store_name,
        function: w.requisitions.function,
        vendor_id: w.requisitions.vendor_id,
        vendor_name: vendorName,
        from_date: w.requisitions.from_date,
        to_date: w.requisitions.to_date,
        effective_days: effectiveDays,
        rate_per_day: w.rate_per_day,
        suggested_rate: w.requisitions.tentative_rate,
        payment_status: w.payment_status,
        payment_remarks: w.payment_remarks,
        amount: w.rate_per_day ? Math.round(w.rate_per_day * effectiveDays * 100) / 100 : null,
      };
    });

  // Filters
  if (searchParams?.vendor) rows = rows.filter((r) => r.vendor_id === searchParams.vendor);
  if (searchParams?.payment_status) rows = rows.filter((r) => r.payment_status === searchParams.payment_status);
  if (searchParams?.store) rows = rows.filter((r) => r.store_name === searchParams.store);

  const vendorOptions = (vendors || []).map((v) => ({ id: v.id, name: v.name }));
  const stores = [...new Set((workers || []).map((w) => w.requisitions?.store_name).filter(Boolean))].sort();

  const totalWorkers = rows.length;
  const totalDays = rows.reduce((s, r) => s + r.effective_days, 0);
  const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const pendingCount = rows.filter((r) => r.payment_status === "pending").length;

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
    <div className="container" style={{ maxWidth: 1100 }}>
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Payments</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        Set the final per-day rate for each worker — the amount payable is calculated automatically from
        that rate and their marked attendance (Half Day counts as 0.5).
      </p>

      <KpiStrip
        stats={[
          { label: "Workers", value: totalWorkers },
          { label: "Total person-days", value: totalDays },
          { label: "Total payable", value: `₹${totalAmount.toLocaleString("en-IN")}` },
          { label: "Pending payment", value: pendingCount },
        ]}
      />

      <Suspense fallback={null}>
        <PaymentsFilterBar vendors={vendorOptions} stores={stores} />
      </Suspense>

      <PaymentsTable rows={rows} saveAction={boundSaveAction} csvRows={csvRows} />
    </div>
  );
}
