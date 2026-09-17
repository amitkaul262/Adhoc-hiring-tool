"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendRequisitionDecisionEmail, sendVendorNeededEmail, sendRequisitionModifiedEmail } from "@/lib/email";
import { PREVIEW_MODE } from "@/lib/mockData";

export async function decideRequisition(requisitionId, hodEmail, decision, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — approvals aren't connected to Supabase yet." };
  }

  const remarks = (formData.get("remarks") || "").toString().trim();
  if (decision === "rejected" && !remarks) {
    return { error: "Add a short reason so the store manager knows why this was rejected." };
  }

  const supabase = createSupabaseServerClient();

  const { data: requisition, error } = await supabase
    .from("requisitions")
    .update({
      status: decision,
      hod_action_at: new Date().toISOString(),
      hod_remarks: remarks || null,
    })
    .eq("requisition_id", requisitionId)
    .eq("hod_email", hodEmail) // RLS already enforces this, kept here as an explicit guard too
    .select()
    .single();

  if (error || !requisition) {
    console.error("decideRequisition update failed:", error);
    return { error: "Couldn't record that decision. Please try again." };
  }

  await supabase.from("requisition_events").insert({
    requisition_id: requisitionId,
    event_type: decision === "approved" ? "hod_approved" : "hod_rejected",
    actor_email: hodEmail,
    remarks: remarks || null,
  });

  try {
    await sendRequisitionDecisionEmail(requisition);
  } catch (e) {
    console.error("sendRequisitionDecisionEmail failed:", e);
  }

  if (decision === "approved") {
    try {
      await sendVendorNeededEmail(requisition);
    } catch (e) {
      console.error("sendVendorNeededEmail failed:", e);
    }
  }

  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, success: true, decided: decision };
}

// HOD can adjust a requisition's operational terms — headcount, rate,
// dates — while it's still pending their decision, e.g. "asked for 10,
// we only actually need 8." This is allowed by the existing RLS policy
// for HOD (which grants update rights on anything routed to them, no
// status restriction at the database level) — the "must still be
// pending" rule enforced below is a deliberate app-layer business
// decision, not a database limitation.
export async function updateRequisitionTerms(requisitionId, hodEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — editing isn't connected to Supabase yet." };
  }

  const supabase = createSupabaseServerClient();

  const { data: current } = await supabase
    .from("requisitions")
    .select("status, hod_email")
    .eq("requisition_id", requisitionId)
    .single();

  if (!current) return { error: "Requisition not found." };
  if (current.hod_email !== hodEmail) return { error: "This requisition isn't routed to you." };
  if (current.status !== "pending_hod_approval") {
    return { error: "This requisition has already been decided and can no longer be modified." };
  }

  const number_of_workers = Number(formData.get("number_of_workers"));
  const tentative_rate = Number(formData.get("tentative_rate"));
  const from_date = formData.get("from_date");
  const to_date = formData.get("to_date");

  if (!Number.isInteger(number_of_workers) || number_of_workers < 1) {
    return { error: "Enter a valid number of workers (a whole number, at least 1)." };
  }
  if (isNaN(tentative_rate) || tentative_rate < 0) {
    return { error: "Enter a valid rate." };
  }
  if (!from_date || !to_date) {
    return { error: "Select both a from and a to date." };
  }
  if (to_date < from_date) {
    return { error: "The to date can't be before the from date." };
  }

  const { data: updated, error } = await supabase
    .from("requisitions")
    .update({ number_of_workers, tentative_rate, from_date, to_date })
    .eq("requisition_id", requisitionId)
    .select()
    .single();

  if (error || !updated) {
    console.error("updateRequisitionTerms failed:", error);
    return { error: "Couldn't save changes. Please try again." };
  }

  await supabase.from("requisition_events").insert({
    requisition_id: requisitionId,
    event_type: "modified_by_hod",
    actor_email: hodEmail,
    remarks: `Set to ${number_of_workers} worker(s), ₹${tentative_rate}/day, ${from_date} to ${to_date}`,
  });

  try {
    await sendRequisitionModifiedEmail(updated, hodEmail);
  } catch (e) {
    console.error("sendRequisitionModifiedEmail failed:", e);
  }

  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, success: true };
}
