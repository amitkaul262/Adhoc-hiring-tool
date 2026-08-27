import { createSupabaseServerClient } from "@/lib/supabaseServer";

const EFFECTIVE_DAYS = { full_day: 1, half_day: 0.5, absent: 0, leave: 0 };

// Shared by both the requisition-wise Payments list (which aggregates
// these into one row per requisition) and the per-requisition detail
// page (which shows them as-is, one row per worker). Optionally scoped
// to a single requisition_id.
export async function fetchWorkerPaymentRows(requisitionId = null) {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("requisition_workers")
    .select("*, requisitions(worker_type, store_name, function, cost_center, vendor_id, from_date, to_date, status, tentative_rate, reason, reason_other, hod_email, raised_by_email, invoice_number)")
    .order("created_at", { ascending: false });
  if (requisitionId) query = query.eq("requisition_id", requisitionId);

  const [{ data: workers }, { data: vendors }, { data: attendanceRows }] = await Promise.all([
    query,
    supabase.from("vendors").select("id, name"),
    (() => {
      let attendanceQuery = supabase.from("requisition_attendance").select("requisition_worker_id, status").not("status", "is", null);
      if (requisitionId) attendanceQuery = attendanceQuery.eq("requisition_id", requisitionId);
      return attendanceQuery;
    })(),
  ]);

  const vendorNameById = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]));

  const daysByWorker = {};
  const breakdownByWorker = {};
  for (const row of attendanceRows || []) {
    daysByWorker[row.requisition_worker_id] = (daysByWorker[row.requisition_worker_id] || 0) + (EFFECTIVE_DAYS[row.status] ?? 0);
    breakdownByWorker[row.requisition_worker_id] ||= { full_day: 0, half_day: 0, absent: 0, leave: 0 };
    if (breakdownByWorker[row.requisition_worker_id][row.status] !== undefined) {
      breakdownByWorker[row.requisition_worker_id][row.status] += 1;
    }
  }

  const rows = (workers || [])
    .filter((w) => w.requisitions?.status === "approved")
    .map((w) => {
      const effectiveDays = daysByWorker[w.id] || 0;
      const breakdown = breakdownByWorker[w.id] || { full_day: 0, half_day: 0, absent: 0, leave: 0 };
      const vendorName = w.requisitions.vendor_id ? vendorNameById[w.requisitions.vendor_id] || "Unknown vendor" : null;
      return {
        id: w.id,
        requisition_id: w.requisition_id,
        worker_name: w.worker_name || `Worker ${w.slot_number}`,
        worker_type: w.requisitions.worker_type,
        store_name: w.requisitions.store_name,
        function: w.requisitions.function,
        cost_center: w.requisitions.cost_center,
        reason: w.requisitions.reason === "Other" ? (w.requisitions.reason_other || "Other") : w.requisitions.reason,
        hod_email: w.requisitions.hod_email,
        raised_by_email: w.requisitions.raised_by_email,
        invoice_number: w.requisitions.invoice_number,
        vendor_id: w.requisitions.vendor_id,
        vendor_name: vendorName,
        from_date: w.requisitions.from_date,
        to_date: w.requisitions.to_date,
        effective_days: effectiveDays,
        full_days: breakdown.full_day,
        half_days: breakdown.half_day,
        absent_days: breakdown.absent,
        leave_days: breakdown.leave,
        rate_per_day: w.rate_per_day,
        suggested_rate: w.requisitions.tentative_rate,
        payment_status: w.payment_status,
        payment_remarks: w.payment_remarks,
        payment_updated_at: w.payment_updated_at,
        paid_at: w.paid_at,
        amount: w.rate_per_day ? Math.round(w.rate_per_day * effectiveDays * 100) / 100 : null,
      };
    });

  return { rows, vendors: vendors || [] };
}

// Rolls per-worker rows up into one summary row per requisition, for the
// list view — a 10-worker requisition is one line item, not ten.
export function summarizeByRequisition(rows) {
  const byReq = {};
  for (const r of rows) {
    byReq[r.requisition_id] ||= {
      requisition_id: r.requisition_id,
      worker_type: r.worker_type,
      store_name: r.store_name,
      function: r.function,
      cost_center: r.cost_center,
      reason: r.reason,
      hod_email: r.hod_email,
      raised_by_email: r.raised_by_email,
      invoice_number: r.invoice_number,
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      from_date: r.from_date,
      to_date: r.to_date,
      worker_count: 0,
      total_days: 0,
      total_amount: 0,
      rate_missing_count: 0,
      statuses: [],
    };
    const s = byReq[r.requisition_id];
    s.worker_count += 1;
    s.total_days += r.effective_days;
    s.total_amount += r.amount || 0;
    if (r.rate_per_day === null || r.rate_per_day === undefined) s.rate_missing_count += 1;
    s.statuses.push(r.payment_status);
  }

  return Object.values(byReq).map((s) => {
    const allPaid = s.statuses.every((st) => st === "paid");
    const allPending = s.statuses.every((st) => st === "pending");
    const rollupStatus = allPaid ? "paid" : allPending ? "pending" : "partially_paid";
    return { ...s, rollup_status: rollupStatus };
  });
}
