"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendRequisitionDecisionEmail } from "@/lib/email";
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

  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, decided: decision };
}
