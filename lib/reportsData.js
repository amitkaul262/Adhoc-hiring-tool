import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchWorkerPaymentRows, summarizeByRequisition } from "@/lib/paymentsData";
import { totalDaysInclusive } from "@/lib/businessDays";

const DECISION_LABELS = {
  pending_hod_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// The single "everything about this requisition, start to paid" report —
// one row per requisition, every status (not just approved), covering
// the full lifecycle: raised → decided → vendor assigned → attendance
// completed → paid. Attendance/payment fields are blank for requisitions
// that never reached that stage (still pending, or rejected).
export async function fetchMasterReport() {
  const supabase = createSupabaseServerClient();

  const [{ data: requisitions }, { data: vendors }, { rows: paymentRows }] = await Promise.all([
    supabase.from("requisitions").select("*").order("created_at", { ascending: false }),
    supabase.from("vendors").select("id, name"),
    fetchWorkerPaymentRows(), // already scoped to approved requisitions with worker data
  ]);

  const vendorNameById = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]));
  const rollupByReqId = Object.fromEntries(summarizeByRequisition(paymentRows).map((s) => [s.requisition_id, s]));

  return (requisitions || []).map((req) => {
    const rollup = rollupByReqId[req.requisition_id];
    const expectedCells = rollup ? rollup.worker_count * totalDaysInclusive(req.from_date, req.to_date) : 0;

    return {
      requisition_id: req.requisition_id,
      worker_type: req.worker_type,
      store_name: req.store_name,
      store_code: req.store_code,
      function: req.function,
      cost_center: req.cost_center,
      reason: req.reason === "Other" ? req.reason_other || "Other" : req.reason,
      number_of_workers: req.number_of_workers,
      tentative_rate: req.tentative_rate,
      from_date: req.from_date,
      to_date: req.to_date,

      raised_by_email: req.raised_by_email,
      raised_at: req.created_at,

      hod_email: req.hod_email,
      decision: DECISION_LABELS[req.status] || req.status,
      decided_at: req.hod_action_at,
      hod_remarks: req.hod_remarks,

      vendor_name: req.vendor_id ? vendorNameById[req.vendor_id] || "Unknown vendor" : null,
      gst_percentage: rollup?.gst_percentage ?? null,
      vendor_assigned_at: req.vendor_assigned_at,

      attendance_worker_count: rollup?.worker_count || 0,
      attendance_expected_cells: expectedCells,
      attendance_effective_days: rollup?.total_days || 0,
      attendance_completed_at: req.attendance_completed_at,
      attendance_frozen: req.attendance_frozen,
      attendance_frozen_at: req.attendance_frozen_at,

      total_base_amount: Math.round((rollup?.total_base_amount || 0) * 100) / 100,
      total_gst_amount: Math.round((rollup?.total_gst_amount || 0) * 100) / 100,
      total_amount: rollup?.total_amount || 0,
      payment_status: rollup ? rollup.rollup_status : req.status === "approved" ? "pending" : null,
      fully_paid_at: rollup?.fully_paid_at || null,

      invoice_number: req.invoice_number,
      invoice_file_url: req.invoice_file_url,
    };
  });
}
