import { fetchWorkerPaymentRows } from "@/lib/paymentsData";

// The vendor-wise counterpart to the requisition-wise Reports page —
// groups every worker payment row by vendor (not by requisition), since
// "how much do we owe ABC Pvt Ltd across everything" is a genuinely
// different question than "what does this one requisition cost." Uses
// each worker's own effective vendor (already resolved with the
// requisition-level fallback baked into fetchWorkerPaymentRows), so a
// split requisition correctly contributes to BOTH vendors involved, not
// just one.
export async function fetchVendorWiseReport() {
  const { rows } = await fetchWorkerPaymentRows();

  const byVendor = {};
  function bucket(key, name) {
    byVendor[key] ||= {
      vendor_id: key === "unassigned" ? null : key,
      vendor_name: name,
      requisitionIds: new Set(),
      worker_count: 0,
      total_days: 0,
      total_base_amount: 0,
      total_gst_amount: 0,
      total_amount: 0,
      paid_count: 0,
      pending_count: 0,
      partially_paid_count: 0,
      gst_percentages: new Set(),
    };
    return byVendor[key];
  }

  for (const r of rows) {
    const key = r.vendor_id || "unassigned";
    const name = r.vendor_id ? r.vendor_name : "Not assigned";
    const b = bucket(key, name);
    b.requisitionIds.add(r.requisition_id);
    b.worker_count += 1;
    b.total_days += r.effective_days;
    b.total_base_amount += r.base_amount || 0;
    b.total_gst_amount += r.gst_amount || 0;
    b.total_amount += r.amount || 0;
    if (r.vendor_id) b.gst_percentages.add(r.gst_percentage ?? 0);
    if (r.payment_status === "paid") b.paid_count += 1;
    else if (r.payment_status === "partially_paid") b.partially_paid_count += 1;
    else b.pending_count += 1;
  }

  return Object.values(byVendor)
    .map((b) => ({
      vendor_id: b.vendor_id,
      vendor_name: b.vendor_name,
      requisition_count: b.requisitionIds.size,
      worker_count: b.worker_count,
      total_days: Math.round(b.total_days * 100) / 100,
      total_base_amount: Math.round(b.total_base_amount * 100) / 100,
      total_gst_amount: Math.round(b.total_gst_amount * 100) / 100,
      total_amount: Math.round(b.total_amount * 100) / 100,
      paid_count: b.paid_count,
      pending_count: b.pending_count,
      partially_paid_count: b.partially_paid_count,
      // Only meaningful when the vendor has one consistent rate — shown
      // as "—" (not 0) if somehow inconsistent across records, rather
      // than implying a rate that isn't real.
      gst_percentage: b.gst_percentages.size === 1 ? [...b.gst_percentages][0] : null,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);
}
