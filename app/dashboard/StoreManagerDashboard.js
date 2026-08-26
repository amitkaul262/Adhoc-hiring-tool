import Link from "next/link";
import RequisitionTable from "@/components/RequisitionTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS } from "@/lib/mockData";

export default async function StoreManagerDashboard({ employee }) {
  let requisitions;
  if (PREVIEW_MODE) {
    requisitions = MOCK_REQUISITIONS;
  } else {
    const supabase = createSupabaseServerClient();
    ({ data: requisitions } = await supabase
      .from("requisitions")
      .select("*")
      .eq("raised_by_email", employee.email)
      .order("created_at", { ascending: false }));
  }

  return (
    <div className="container">
      <span className="eyebrow">Store Manager</span>
      <div className="section-header">
        <h1>{employee.store_name || employee.full_name}</h1>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="profile-grid">
          <div className="profile-field"><div className="label">Store</div><div className="value">{employee.store_name || "-"}</div></div>
          <div className="profile-field"><div className="label">Store code</div><div className="value">{employee.store_code || "-"}</div></div>
          <div className="profile-field"><div className="label">Function</div><div className="value">{employee.function || "-"}</div></div>
          <div className="profile-field"><div className="label">Cost center</div><div className="value">{employee.cost_center || "-"}</div></div>
          <div className="profile-field"><div className="label">Reports to</div><div className="value">{employee.reports_to_email || "-"}</div></div>
        </div>
      </div>

      <div className="section-header">
        <h2>Your requisitions</h2>
        <Link href="/requisitions/new" className="btn btn-primary">+ Raise requisition</Link>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: requisitions?.length ? "8px 16px" : 0 }}>
          <RequisitionTable requisitions={requisitions} />
        </div>
      </div>
    </div>
  );
}
