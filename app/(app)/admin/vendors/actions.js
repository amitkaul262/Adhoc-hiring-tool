"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

function readVendorFields(formData) {
  return {
    name: (formData.get("name") || "").toString().trim(),
    contact_name: (formData.get("contact_name") || "").toString().trim() || null,
    contact_email: (formData.get("contact_email") || "").toString().trim() || null,
    contact_phone: (formData.get("contact_phone") || "").toString().trim() || null,
  };
}

export async function createVendor(prevState, formData) {
  const fields = readVendorFields(formData);
  if (!fields.name) {
    return { error: "Enter a vendor name." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("vendors").insert({ ...fields, is_active: true });

  if (error) {
    console.error("createVendor failed:", error);
    if (error.code === "23505") {
      return { error: "A vendor with that name already exists." };
    }
    return { error: "Couldn't add this vendor. Please try again." };
  }

  revalidatePath("/admin/vendors");
  redirect("/admin/vendors");
}

export async function updateVendor(vendorId, prevState, formData) {
  const fields = readVendorFields(formData);
  const is_active = formData.get("is_active") === "on";

  if (!fields.name) {
    return { error: "Enter a vendor name." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("vendors")
    .update({ ...fields, is_active })
    .eq("id", vendorId);

  if (error) {
    console.error("updateVendor failed:", error);
    return { error: "Couldn't save changes. Please try again." };
  }

  revalidatePath("/admin/vendors");
  redirect("/admin/vendors");
}
