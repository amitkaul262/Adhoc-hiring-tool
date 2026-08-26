import HodQueueTable from "@/components/HodQueueTable";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS } from "@/lib/mockData";

export default async function HodDashboard({ employee }) {
  let pending = [], decided = [];

  if (PREVIEW_MODE) {
    // No HOD-specific mock scenario yet — preview mode was built around
    // the store manager flow. Showing the same sample data here at least
    // keeps the layout reviewable.
    pending = MOCK_REQUISITIONS.filter((r) => r.status === "pending_hod_approval");
    decided = MOCK_REQUISITIONS.filter((r) => r.status !== "pending_hod_approval");
  } else {
    const supabase = createSupabaseServerClient();
    const { data: all } = await supabase
      .from("requisitions")
      .select("*")
      .eq("hod_email", employee.email)
      .order("created_at", { ascending: false });
    pending = (all || []).filter((r) => r.status === "pending_hod_approval");
    decided = (all || []).filter((r) => r.status !== "pending_hod_approval");
  }

  return (
    <div className="container">
      <span className="eyebrow">HOD</span>
      <div className="section-header">
        <h1>{employee.full_name}</h1>
      </div>

      <div className="section-header">
        <h2>Awaiting your approval {pending.length > 0 && `(${pending.length})`}</h2>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        <div style={{ padding: pending.length ? "8px 16px" : 0 }}>
          <HodQueueTable requisitions={pending} emptyLabel="Nothing waiting on you right now." />
        </div>
      </div>

      <div className="section-header">
        <h2>Past decisions</h2>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: decided.length ? "8px 16px" : 0 }}>
          <HodQueueTable requisitions={decided} emptyLabel="No decisions yet." />
        </div>
      </div>
    </div>
  );
}
