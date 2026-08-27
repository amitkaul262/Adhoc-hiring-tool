"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendAttendanceUnfrozenEmail } from "@/lib/email";
import { PREVIEW_MODE } from "@/lib/mockData";

export async function markAttendance(requisitionId, employeeEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return {
      error:
        "Preview mode — attendance isn't connected to Supabase yet, so saving is disabled. This is just to review the UI for now.",
    };
  }

  const supabase = createSupabaseServerClient();

  // Check first for a clear error message — RLS also blocks this at the
  // database level as a second line of defense, but that failure alone
  // would just look like a generic save error to the person marking it.
  const { data: requisition } = await supabase
    .from("requisitions")
    .select("attendance_frozen")
    .eq("requisition_id", requisitionId)
    .single();

  if (requisition?.attendance_frozen) {
    return { error: "This register is locked. Only an admin can unlock it before it can be edited." };
  }

  let entries, names;
  try {
    entries = JSON.parse(formData.get("attendance_json") || "[]");
    names = JSON.parse(formData.get("worker_names_json") || "[]");
  } catch {
    return { error: "Something went wrong reading the register. Try again." };
  }

  // Worker names first — harmless to update even if unchanged.
  for (const n of names) {
    if (!n.id) continue;
    await supabase
      .from("requisition_workers")
      .update({ worker_name: (n.worker_name || "").trim() || null })
      .eq("id", n.id);
  }

  if (entries.length > 0) {
    const rows = entries.map((e) => ({
      requisition_id: requisitionId,
      requisition_worker_id: e.requisition_worker_id,
      attendance_date: e.attendance_date,
      status: e.status,
      marked_by_email: employeeEmail,
    }));

    const { error } = await supabase
      .from("requisition_attendance")
      .upsert(rows, { onConflict: "requisition_worker_id,attendance_date" });

    if (error) {
      console.error("markAttendance upsert failed:", error);
      return { error: "Couldn't save attendance. Please try again." };
    }
  }

  revalidatePath(`/requisitions/${requisitionId}/attendance`);
  return { error: null, success: true };
}

// Admin-only — enforced by whoever calls/binds this (the attendance page
// only renders the button for employee.role === 'admin'), and RLS on
// `requisitions` already restricts updates to hr/admin regardless.
export async function unfreezeAttendance(requisitionId, adminEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — unfreezing isn't connected to Supabase yet." };
  }

  const supabase = createSupabaseServerClient();

  const { data: requisition, error } = await supabase
    .from("requisitions")
    .update({ attendance_frozen: false, attendance_frozen_at: null })
    .eq("requisition_id", requisitionId)
    .select()
    .single();

  if (error || !requisition) {
    console.error("unfreezeAttendance update failed:", error);
    return { error: "Couldn't unlock this register. Please try again." };
  }

  await supabase.from("requisition_events").insert({
    requisition_id: requisitionId,
    event_type: "attendance_unfrozen",
    actor_email: adminEmail,
  });

  try {
    await sendAttendanceUnfrozenEmail(requisition, adminEmail);
  } catch (e) {
    console.error("sendAttendanceUnfrozenEmail failed:", e);
  }

  revalidatePath(`/requisitions/${requisitionId}/attendance`);
  return { error: null, success: true };
}
