"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendRequisitionRaisedEmail } from "@/lib/email";

const WORKER_TYPES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];

export async function createRequisition(employee, prevState, formData) {
  const worker_type = formData.get("worker_type");
  const tentative_rate = Number(formData.get("tentative_rate"));
  const number_of_workers = Number(formData.get("number_of_workers"));
  const from_date = formData.get("from_date");
  const to_date = formData.get("to_date");

  if (!WORKER_TYPES.includes(worker_type)) {
    return { error: "Choose a worker type." };
  }
  if (!tentative_rate || tentative_rate <= 0) {
    return { error: "Enter a valid tentative rate." };
  }
  if (!number_of_workers || number_of_workers <= 0) {
    return { error: "Enter a valid number of workers." };
  }
  if (!from_date || !to_date) {
    return { error: "Select both a from and a to date." };
  }
  if (to_date < from_date) {
    return { error: "The to date can't be before the from date." };
  }
  if (!employee.reports_to_email) {
    return {
      error:
        "No HOD is mapped to your account yet, so this can't be routed for approval. Ask HR to set your reporting HOD.",
    };
  }

  const supabase = createSupabaseServerClient();

  const { data: requisition, error } = await supabase
    .from("requisitions")
    .insert({
      raised_by_email: employee.email,
      store_name: employee.store_name,
      store_code: employee.store_code,
      cost_center: employee.cost_center,
      function: employee.function,
      worker_type,
      tentative_rate,
      number_of_workers,
      from_date,
      to_date,
      hod_email: employee.reports_to_email,
    })
    .select()
    .single();

  if (error) {
    console.error("createRequisition insert failed:", error);
    return { error: "Couldn't save the requisition. Please try again." };
  }

  await supabase.from("requisition_events").insert([
    { requisition_id: requisition.requisition_id, event_type: "raised", actor_email: employee.email },
    {
      requisition_id: requisition.requisition_id,
      event_type: "hr_notified",
      actor_email: employee.email,
      remarks: "HR cc'd on the requisition-raised email to the HOD",
    },
  ]);

  try {
    await sendRequisitionRaisedEmail(requisition);
  } catch (e) {
    // The requisition is already saved — don't block the user on a mail failure,
    // but this is worth surfacing in logs/monitoring.
    console.error("sendRequisitionRaisedEmail failed:", e);
  }

  redirect(`/requisitions/${requisition.requisition_id}`);
}
