import VendorForm from "@/components/VendorForm";
import { updateVendor } from "../../actions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";

export default async function EditVendorPage({ params }) {
  const supabase = createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", params.vendorId)
    .single();

  if (!vendor) notFound();

  const boundAction = updateVendor.bind(null, vendor.id);

  return (
    <>
      <div className="section-header">
        <h2>Edit {vendor.name}</h2>
      </div>
      <VendorForm action={boundAction} initial={vendor} isEdit />
    </>
  );
}
