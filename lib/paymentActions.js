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

  for (const r of rows) {
    const { error } = await supabase
      .from("requisition_workers")
      .update({
        rate_per_day: r.rate_per_day === "" || r.rate_per_day === null ? null : Number(r.rate_per_day),
        payment_status: r.payment_status,
        payment_remarks: (r.payment_remarks || "").trim() || null,
        payment_updated_by: actorEmail,
        payment_updated_at: now,
      })
      .eq("id", r.id);

    if (error) {
      console.error("saveWorkerPayments failed for", r.id, error);
      return { error: "Couldn't save one or more rows. Please try again." };
    }
  }

  revalidatePath("/payments");
  return { error: null, success: true };
}
