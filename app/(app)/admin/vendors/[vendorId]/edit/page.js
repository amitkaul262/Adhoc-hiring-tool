import VendorForm from "@/components/VendorForm";
import { updateVendor } from "../../actions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchVendorStats } from "@/lib/vendorStats";
import { notFound } from "next/navigation";

export default async function EditVendorPage({ params }) {
  const supabase = createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", params.vendorId)
    .single();

  if (!vendor) notFound();

  const stats = await fetchVendorStats(params.vendorId);
  const boundAction = updateVendor.bind(null, vendor.id);

  return (
    <>
      <div className="section-header">
        <h2>Edit {vendor.name}</h2>
      </div>

      {stats.requisitionCount > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Track record</h3>
          <div className="vendor-stat-grid">
            <div>
              <div className="vendor-stat-value">{stats.requisitionCount}</div>
              <div className="vendor-stat-label">Requisitions</div>
            </div>
            <div>
              <div className="vendor-stat-value">{stats.workerCount}</div>
              <div className="vendor-stat-label">Workers deployed</div>
            </div>
            <div>
              <div className="vendor-stat-value">{stats.reliabilityPct !== null ? `${stats.reliabilityPct}%` : "—"}</div>
              <div className="vendor-stat-label">Attendance reliability</div>
            </div>
            <div>
              <div className="vendor-stat-value">{stats.avgFillTime}</div>
              <div className="vendor-stat-label">Avg. time to assign</div>
            </div>
          </div>
        </div>
      )}

      <VendorForm action={boundAction} initial={vendor} isEdit />
    </>
  );
}
