"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendVendorAssignedEmail } from "@/lib/email";
import { PREVIEW_MODE } from "@/lib/mockData";

export async function assignVendor(requisitionId, hrEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — vendor assignment isn't connected to Supabase yet." };
  }

  const vendorId = formData.get("vendor_id");
  if (!vendorId) {
    return { error: "Pick a vendor first." };
  }

  const supabase = createSupabaseServerClient();

  const { data: vendor } = await supabase.from("vendors").select("name").eq("id", vendorId).single();

  const { data: requisition, error } = await supabase
    .from("requisitions")
    .update({
      vendor_id: vendorId,
      vendor_assigned_by: hrEmail,
      vendor_assigned_at: new Date().toISOString(),
    })
    .eq("requisition_id", requisitionId)
    .select()
    .single();

  if (error || !requisition) {
    console.error("assignVendor update failed:", error);
    return { error: "Couldn't assign that vendor. Please try again." };
  }

  await supabase.from("requisition_events").insert({
    requisition_id: requisitionId,
    event_type: "vendor_assigned",
    actor_email: hrEmail,
  });

  try {
    await sendVendorAssignedEmail(requisition, vendor?.name || "Your vendor");
  } catch (e) {
    console.error("sendVendorAssignedEmail failed:", e);
  }

  revalidatePath(`/requisitions/${requisitionId}`);
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
