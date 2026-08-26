"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const ROLES = ["store_manager", "hod", "hr", "admin"];

function readPersonFields(formData) {
  return {
    full_name: (formData.get("full_name") || "").toString().trim(),
    role: formData.get("role"),
    function: (formData.get("function") || "").toString().trim() || null,
    cost_center: (formData.get("cost_center") || "").toString().trim() || null,
    store_name: (formData.get("store_name") || "").toString().trim() || null,
    store_code: (formData.get("store_code") || "").toString().trim() || null,
    reports_to_email: (formData.get("reports_to_email") || "").toString().trim().toLowerCase() || null,
  };
}

export async function createPerson(prevState, formData) {
  const email = (formData.get("email") || "").toString().trim().toLowerCase();
  const fields = readPersonFields(formData);

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (!fields.full_name) {
    return { error: "Enter a name." };
  }
  if (!ROLES.includes(fields.role)) {
    return { error: "Pick a role." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("employee_master").insert({ email, ...fields, is_active: true });

  if (error) {
    console.error("createPerson failed:", error);
    if (error.code === "23505") {
      return { error: "Someone with that email already exists." };
    }
    return { error: "Couldn't add this person. Please try again." };
  }

  revalidatePath("/admin/people");
  redirect("/admin/people");
}

export async function updatePerson(email, prevState, formData) {
  const fields = readPersonFields(formData);
  const is_active = formData.get("is_active") === "on";

  if (!fields.full_name) {
    return { error: "Enter a name." };
  }
  if (!ROLES.includes(fields.role)) {
    return { error: "Pick a role." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("employee_master")
    .update({ ...fields, is_active })
    .eq("email", email);

  if (error) {
    console.error("updatePerson failed:", error);
    return { error: "Couldn't save changes. Please try again." };
  }

  revalidatePath("/admin/people");
  redirect("/admin/people");
}
