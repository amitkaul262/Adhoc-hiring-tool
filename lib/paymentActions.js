"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabaseServer";
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

  // Need each row's current payment_status to detect a genuine transition
  // into "paid" — paid_at should be set once, the first time, and then
  // stay put even if the row is edited again later (e.g. a remark added).
  const ids = rows.map((r) => r.id);
  const { data: current } = await supabase
    .from("requisition_workers")
    .select("id, requisition_id, payment_status, paid_at")
    .in("id", ids.length ? ids : [""]);
  const currentById = Object.fromEntries((current || []).map((c) => [c.id, c]));

  for (const r of rows) {
    const prior = currentById[r.id];
    const becomingPaid = r.payment_status === "paid" && prior?.payment_status !== "paid";
    const paid_at = becomingPaid ? now : prior?.paid_at ?? null;

    const { error } = await supabase
      .from("requisition_workers")
      .update({
        rate_per_day: r.rate_per_day === "" || r.rate_per_day === null ? null : Number(r.rate_per_day),
        payment_status: r.payment_status,
        payment_remarks: (r.payment_remarks || "").trim() || null,
        payment_updated_by: actorEmail,
        payment_updated_at: now,
        paid_at,
      })
      .eq("id", r.id);

    if (error) {
      console.error("saveWorkerPayments failed for", r.id, error);
      return { error: "Couldn't save one or more rows. Please try again." };
    }
  }

  revalidatePath("/payments");
  const affectedRequisitions = [...new Set((current || []).map((c) => c.requisition_id))];

  // Once every worker on a requisition is paid, lock it down to
  // admin-only edits by setting fully_paid_at — RLS on attendance,
  // worker payment info, and the requisition record itself all check
  // this. Uses the admin client since this is a system-derived fact,
  // not a user-authored edit, matching the attendance_completed_at
  // pattern. If a requisition is no longer fully paid (an admin
  // reverted a status — the only one who still could, once locked),
  // clear it back to null so normal access resumes.
  const admin = createSupabaseAdminClient();
  for (const reqId of affectedRequisitions) {
    const [{ data: allWorkers }, { data: reqRow }] = await Promise.all([
      supabase.from("requisition_workers").select("payment_status").eq("requisition_id", reqId),
      supabase.from("requisitions").select("fully_paid_at").eq("requisition_id", reqId).single(),
    ]);
    const allPaid = (allWorkers || []).length > 0 && (allWorkers || []).every((w) => w.payment_status === "paid");
    const wasAlreadyFullyPaid = !!reqRow?.fully_paid_at;

    if (allPaid && !wasAlreadyFullyPaid) {
      await admin.from("requisitions").update({ fully_paid_at: now }).eq("requisition_id", reqId);
    } else if (!allPaid && wasAlreadyFullyPaid) {
      await admin.from("requisitions").update({ fully_paid_at: null }).eq("requisition_id", reqId);
    }
    // Otherwise: no change in fully-paid state — leave the existing
    // timestamp (or lack of one) exactly as it was.
  }

  for (const reqId of affectedRequisitions) {
    revalidatePath(`/payments/${reqId}`);
    revalidatePath(`/requisitions/${reqId}`);
  }
  return { error: null, success: true };
}

// Uploads a file to Drive via the Apps Script relay (see
// apps-script/Code.gs's handleUploadFile) and saves the resulting
// shareable link as the requisition's invoice_file_url — this is what
// makes "upload an attachment" work without the app itself ever needing
// its own Drive API credentials or OAuth token storage.
export async function uploadInvoiceFile(requisitionId, actorEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — file upload isn't connected to Supabase yet." };
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) {
    return { error: "Choose a file first." };
  }
  const MAX_BYTES = 4 * 1024 * 1024; // 4MB — comfortably under typical serverless body-size limits
  if (file.size > MAX_BYTES) {
    return { error: "That file is too large — please keep it under 4MB." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let uploadResult;
  try {
    const res = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.APPS_SCRIPT_SECRET,
        action: "upload_file",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: base64,
      }),
    });
    uploadResult = await res.json();
  } catch (e) {
    console.error("uploadInvoiceFile: relay call failed:", e);
    return { error: "Couldn't reach the upload service. Please try again." };
  }

  if (uploadResult.error) {
    console.error("uploadInvoiceFile: relay returned error:", uploadResult.error);
    return { error: `Upload failed: ${uploadResult.error}` };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("requisitions")
    .update({ invoice_file_url: uploadResult.url })
    .eq("requisition_id", requisitionId);

  if (error) {
    console.error("uploadInvoiceFile: saving url failed:", error);
    return { error: "File uploaded, but couldn't save the link. Please try again." };
  }

  revalidatePath(`/payments/${requisitionId}`);
  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, success: true, url: uploadResult.url };
}

// Saves the vendor invoice number and/or a manually-pasted file link — a
// fallback for when the file already lives somewhere else (e.g. a Drive
// folder outside this app's reach). Uploading via uploadInvoiceFile above
// is the primary path and populates invoice_file_url automatically.
export async function saveInvoiceInfo(requisitionId, actorEmail, prevState, formData) {
  if (PREVIEW_MODE) {
    return { error: "Preview mode — invoice info isn't connected to Supabase yet." };
  }

  const invoiceNumber = (formData.get("invoice_number") || "").toString().trim();
  const invoiceUrl = (formData.get("invoice_file_url") || "").toString().trim();

  if (invoiceUrl && !/^https?:\/\//i.test(invoiceUrl)) {
    return { error: "The invoice link needs to start with http:// or https://" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("requisitions")
    .update({
      invoice_number: invoiceNumber || null,
      invoice_file_url: invoiceUrl || null,
    })
    .eq("requisition_id", requisitionId);

  if (error) {
    console.error("saveInvoiceInfo failed:", error);
    return { error: "Couldn't save invoice info. Please try again." };
  }

  revalidatePath(`/payments/${requisitionId}`);
  revalidatePath(`/requisitions/${requisitionId}`);
  return { error: null, success: true };
}
