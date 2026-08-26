import VendorForm from "@/components/VendorForm";
import { createVendor } from "../actions";

export default function NewVendorPage() {
  return (
    <>
      <div className="section-header">
        <h2>Add vendor</h2>
      </div>
      <VendorForm action={createVendor} />
    </>
  );
}
