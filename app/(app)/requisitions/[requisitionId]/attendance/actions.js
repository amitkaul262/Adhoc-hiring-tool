"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabaseServer";
import { sendAttendanceUnfrozenEmail } from "@/lib/email";
import { totalDaysInclusive } from "@/lib/businessDays";
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
    .select("attendance_frozen, from_date, to_date, number_of_workers, attendance_completed_at")
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

  // Record when the register first became fully marked — feeds the
  // attendance-to-payment turnaround metric in the weekly digest. This is
  // a system-derived fact, not a user-authored edit, so it uses the admin
  // client rather than needing its own RLS grant for whichever role
  // happens to complete the register (store manager or HR).
  if (requisition && !requisition.attendance_completed_at) {
    const { count } = await supabase
      .from("requisition_attendance")
      .select("id", { count: "exact", head: true })
      .eq("requisition_id", requisitionId)
      .not("status", "is", null);
    const expected = requisition.number_of_workers * totalDaysInclusive(requisition.from_date, requisition.to_date);
    if ((count || 0) >= expected) {
      const admin = createSupabaseAdminClient();
      await admin
        .from("requisitions")
        .update({ attendance_completed_at: new Date().toISOString() })
        .eq("requisition_id", requisitionId);
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

// HR/admin adjusts the actual deployed roster when it differs from the
// sanctioned headcount (e.g. store manager asked for 10, vendor could
// only supply 8) — adds one more worker slot at the next available
// number. number_of_workers on the requisition itself is left
// untouched, preserving what was originally sanctioned for reporting.
export async function addWorkerSlot(requisitionId, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — this isn't connected to Supabase yet." };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("requisition_workers")
    .select("slot_number")
    .eq("requisition_id", requisitionId)
    .order("slot_number", { ascending: false })
    .limit(1);

  const nextSlot = (existing?.[0]?.slot_number || 0) + 1;
  const { error } = await supabase
    .from("requisition_workers")
    .insert({ requisition_id: requisitionId, slot_number: nextSlot });

  if (error) {
    console.error("addWorkerSlot failed:", error);
    return { error: "Couldn't add a worker. Please try again." };
  }

  revalidatePath(`/requisitions/${requisitionId}/attendance`);
  return { error: null, success: true };
}

// Removing a worker also removes their attendance rows (cascade delete
// on the foreign key) — meant for correcting a headcount that was never
// actually deployed, not for undoing attendance someone already worked.
export async function removeWorkerSlot(requisitionId, workerId, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — this isn't connected to Supabase yet." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("requisition_workers")
    .delete()
    .eq("id", workerId)
    .eq("requisition_id", requisitionId);

  if (error) {
    console.error("removeWorkerSlot failed:", error);
    return { error: "Couldn't remove that worker. Please try again." };
  }

  revalidatePath(`/requisitions/${requisitionId}/attendance`);
  return { error: null, success: true };
}
