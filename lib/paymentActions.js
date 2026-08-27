"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE } from "@/lib/mockData";

const STATUSES = ["pending", "partially_paid", "paid"];

// HR/admin only — enforced by the page (only employee.role in
// ['hr','admin'] ever reaches the Payments page), backed independently
// by RLS via is_hr_or_admin(). Saves every row in one go, same pattern
// as the attendance register's "save whole grid at once" approach.
export async function saveWorkerPayments(actorEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — payment updates aren't connected to Supabase yet." };
  }

  let rows;
  try {
    rows = JSON.parse(formData.get("payments_json") || "[]");
  } catch {
    return { error: "Something went wrong reading the form. Try again." };
  }

  for (const r of rows) {
    if (!STATUSES.includes(r.payment_status)) {
      return { error: "One of the payment statuses isn't valid." };
    }
    if (r.rate_per_day !== "" && r.rate_per_day !== null && (isNaN(Number(r.rate_per_day)) || Number(r.rate_per_day) < 0)) {
      return { error: "Enter a valid rate for every row." };
    }
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  // Need each row's current payment_status to detect a genuine transition
  // into "paid" — paid_at should be set once, the first time, and then
  // stay put even if the row is edited again later (e.g. a remark added).
  const ids = rows.map((r) => r.id);
  const { data: current } = await supabase
    .from("requisition_workers")
    .select("id, requisition_id, payment_status, paid_at")
    .in("id", ids.length ? ids : [""]);
  const currentById = Object.fromEntries((current || []).map((c) => [c.id, c]));

  for (const r of rows) {
    const prior = currentById[r.id];
    const becomingPaid = r.payment_status === "paid" && prior?.payment_status !== "paid";
    const paid_at = becomingPaid ? now : prior?.paid_at ?? null;

    const { error } = await supabase
      .from("requisition_workers")
      .update({
        rate_per_day: r.rate_per_day === "" || r.rate_per_day === null ? null : Number(r.rate_per_day),
        payment_status: r.payment_status,
        payment_remarks: (r.payment_remarks || "").trim() || null,
        payment_updated_by: actorEmail,
        payment_updated_at: now,
        paid_at,
      })
      .eq("id", r.id);

    if (error) {
      console.error("saveWorkerPayments failed for", r.id, error);
      return { error: "Couldn't save one or more rows. Please try again." };
    }
  }

  revalidatePath("/payments");
  const affectedRequisitions = [...new Set((current || []).map((c) => c.requisition_id))];
  for (const reqId of affectedRequisitions) {
    revalidatePath(`/payments/${reqId}`);
    revalidatePath(`/requisitions/${reqId}`);
  }
  return { error: null, success: true };
}

// Saves the vendor invoice reference for a requisition — a Drive (or any)
// link HR pastes in after uploading the file themselves. Lives on
// requisitions (one invoice typically covers the whole requisition's
// billing), not per-worker.
export async function saveInvoiceInfo(requisitionId, actorEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — invoice info isn't connected to Supabase yet." };
  }

  const invoiceNumber = (formData.get("invoice_number") || "").toString().trim();
  const invoiceUrl = (formData.get("invoice_file_url") || "").toString().trim();

  if (invoiceUrl && !/^https?:\/\//i.test(invoiceUrl)) {
    return { error: "The invoice link needs to start with http:// or https://" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("requisitions")
    .update({
      invoice_number: invoiceNumber || null,
      invoice_file_url: invoiceUrl || null,
    })
    .eq("requisition_id", requisitionId);

  if (error) {
    console.error("saveInvoiceInfo failed:", error);
    return { error: "Couldn't save invoice info. Please try again." };
  }

  revalidatePath(`/payments/${requisitionId}`);
  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, success: true };
}
