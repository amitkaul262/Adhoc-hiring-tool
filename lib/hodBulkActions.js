"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendRequisitionDecisionEmail } from "@/lib/email";
import { PREVIEW_MODE } from "@/lib/mockData";

export async function bulkApprove(hodEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — bulk approval isn't connected to Supabase yet." };
  }

  const ids = formData.getAll("requisition_ids");
  if (!ids || ids.length === 0) {
    return { error: "Select at least one requisition first." };
  }
  const remarks = (formData.get("remarks") || "").toString().trim();

  const supabase = createSupabaseServerClient();

  // RLS still restricts this to rows where hod_email matches the caller,
  // even though we also filter explicitly here — belt and suspenders.
  const { data: updated, error } = await supabase
    .from("requisitions")
    .update({
      status: "approved",
      hod_action_at: new Date().toISOString(),
      hod_remarks: remarks || null,
    })
    .in("requisition_id", ids)
    .eq("hod_email", hodEmail)
    .eq("status", "pending_hod_approval")
    .select();

  if (error) {
    console.error("bulkApprove failed:", error);
    return { error: "Couldn't approve those. Please try again." };
  }
  if (!updated || updated.length === 0) {
    return { error: "Nothing was updated — those requisitions may have already been decided." };
  }

  await supabase.from("requisition_events").insert(
    updated.map((r) => ({
      requisition_id: r.requisition_id,
      event_type: "hod_approved",
      actor_email: hodEmail,
      remarks: remarks || null,
    }))
  );

  for (const r of updated) {
    try {
      await sendRequisitionDecisionEmail(r);
    } catch (e) {
      console.error("sendRequisitionDecisionEmail failed for", r.requisition_id, e);
    }
  }

  revalidatePath("/dashboard");
  return { error: null, approvedCount: updated.length };
}
