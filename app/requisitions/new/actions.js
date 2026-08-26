"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendRequisitionsRaisedEmail } from "@/lib/email";
import { PREVIEW_MODE } from "@/lib/mockData";

const WORKER_TYPES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];

export async function createRequisition(employee, prevState, formData) {
  // PREVIEW MODE: there's no real Supabase project wired up yet, so don't
  // attempt an insert/email — just tell the reviewer why nothing happened.
  // Set PREVIEW_MODE = false in lib/mockData.js once Supabase is connected.
  if (PREVIEW_MODE) {
    return {
      error:
        "Preview mode — this form isn't connected to Supabase yet, so submitting is disabled. This is just to review the UI for now.",
    };
  }

  let roles;
  try {
    roles = JSON.parse(formData.get("roles_json") || "[]");
  } catch {
    return { error: "Something went wrong reading your role selection. Try again." };
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return { error: "Select at least one worker type." };
  }

  const from_date = formData.get("from_date");
  const to_date = formData.get("to_date");

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

  // Validate every role line before writing anything.
  const seen = new Set();
  for (const line of roles) {
    if (!WORKER_TYPES.includes(line.worker_type)) {
      return { error: "One of the selected worker types isn't valid." };
    }
    if (seen.has(line.worker_type)) {
      return { error: `${line.worker_type} is selected more than once — pick it just once and set its total headcount.` };
    }
    seen.add(line.worker_type);

    const count = Number(line.number_of_workers);
    const rate = Number(line.tentative_rate);
    if (!count || count <= 0) {
      return { error: `Enter a valid number of workers for ${line.worker_type}.` };
    }
    if (!rate || rate <= 0) {
      return { error: `Enter a valid tentative rate for ${line.worker_type}.` };
    }
  }

  const supabase = createSupabaseServerClient();
  const batch_id = randomUUID();

  const rows = roles.map((line) => ({
    batch_id,
    raised_by_email: employee.email,
    store_name: employee.store_name,
    store_code: employee.store_code,
    cost_center: employee.cost_center,
    function: employee.function,
    worker_type: line.worker_type,
    tentative_rate: Number(line.tentative_rate),
    number_of_workers: Number(line.number_of_workers),
    from_date,
    to_date,
    hod_email: employee.reports_to_email,
  }));

  const { data: requisitions, error } = await supabase
    .from("requisitions")
    .insert(rows)
    .select();

  if (error) {
    console.error("createRequisition insert failed:", error);
    return { error: "Couldn't save the requisition(s). Please try again." };
  }

  const events = requisitions.flatMap((r) => [
    { requisition_id: r.requisition_id, event_type: "raised", actor_email: employee.email },
    {
      requisition_id: r.requisition_id,
      event_type: "hr_notified",
      actor_email: employee.email,
      remarks: "HR cc'd on the requisition-raised email to the HOD",
    },
  ]);
  await supabase.from("requisition_events").insert(events);

  try {
    await sendRequisitionsRaisedEmail(requisitions);
  } catch (e) {
    // The requisition(s) are already saved — don't block the user on a mail
    // failure, but this is worth surfacing in logs/monitoring.
    console.error("sendRequisitionsRaisedEmail failed:", e);
  }

  redirect("/dashboard");
}
