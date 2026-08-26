"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE } from "@/lib/mockData";

export async function markAttendance(requisitionId, employeeEmail, dates, prevState, formData) {
  if (PREVIEW_MODE) {
    return {
      error:
        "Preview mode — attendance isn't connected to Supabase yet, so saving is disabled. This is just to review the UI for now.",
    };
  }

  const rows = dates.map((date) => ({
    requisition_id: requisitionId,
    attendance_date: date,
    workers_present: Number(formData.get(`present_${date}`) || 0),
    marked_by_email: employeeEmail,
  }));

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("requisition_attendance")
    .upsert(rows, { onConflict: "requisition_id,attendance_date" });

  if (error) {
    console.error("markAttendance upsert failed:", error);
    return { error: "Couldn't save attendance. Please try again." };
  }

  revalidatePath(`/requisitions/${requisitionId}/attendance`);
  return { error: null, success: true };
}
