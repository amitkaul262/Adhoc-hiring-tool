import Link from "next/link";
import HrRequisitionsTable from "@/components/HrRequisitionsTable";
import { assignVendor } from "@/lib/vendorActions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS } from "@/lib/mockData";

export default async function HrDashboard({ employee }) {
  let all = [], activeVendors = [], vendorsById = {};

  if (PREVIEW_MODE) {
    // Preview mode was built around the store manager flow — showing the
    // same sample data here keeps the layout reviewable, but vendor
    // assignment is disabled the same way "raise requisition" is.
    all = MOCK_REQUISITIONS;
  } else {
    const supabase = createSupabaseServerClient();
    const [{ data: reqs }, { data: vendors }] = await Promise.all([
      supabase.from("requisitions").select("*").order("created_at", { ascending: false }),
      supabase.from("vendors").select("id, name, is_active").order("name"),
    ]);
    all = reqs || [];
    activeVendors = (vendors || []).filter((v) => v.is_active);
    vendorsById = Object.fromEntries((vendors || []).map((v) => [v.id, v]));
  }

  const needsVendor = all.filter((r) => r.status === "approved" && !r.vendor_id);
  const rest = all.filter((r) => !(r.status === "approved" && !r.vendor_id));

  return (
    <div className="container">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>{employee.full_name}</h1>
        {employee.role === "admin" && (
          <Link href="/admin/people" className="btn btn-secondary">Admin panel</Link>
        )}
      </div>

      <div className="section-header">
        <h2>Needs a vendor {needsVendor.length > 0 && `(${needsVendor.length})`}</h2>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        <div style={{ padding: needsVendor.length ? "8px 16px" : 0 }}>
          <HrRequisitionsTable
            requisitions={needsVendor}
            vendorsById={vendorsById}
            activeVendors={activeVendors}
            assignActionFor={(id) => assignVendor.bind(null, id, employee.email)}
            showVendorColumn
          />
        </div>
      </div>

      <div className="section-header">
        <h2>All requisitions</h2>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: rest.length ? "8px 16px" : 0 }}>
          <HrRequisitionsTable
            requisitions={rest}
            vendorsById={vendorsById}
            showVendorColumn
          />
        </div>
      </div>
    </div>
  );
}
