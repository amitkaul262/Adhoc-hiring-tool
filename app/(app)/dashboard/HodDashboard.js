import HodQueueTable from "@/components/HodQueueTable";
import HodPendingQueue from "@/components/HodPendingQueue";
import KpiStrip from "@/components/KpiStrip";
import { bulkApprove } from "@/lib/hodBulkActions";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS } from "@/lib/mockData";

function avgApprovalTime(decided) {
  const withTimes = decided.filter((r) => r.hod_action_at && r.created_at);
  if (withTimes.length === 0) return "—";
  const totalMs = withTimes.reduce(
    (sum, r) => sum + (new Date(r.hod_action_at).getTime() - new Date(r.created_at).getTime()),
    0
  );
  const avgHours = totalMs / withTimes.length / 3_600_000;
  if (avgHours < 24) return `${avgHours.toFixed(1)}h`;
  return `${(avgHours / 24).toFixed(1)}d`;
}

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

  const approvedCount = decided.filter((r) => r.status === "approved").length;
  const rejectedCount = decided.filter((r) => r.status === "rejected").length;
  const boundBulkApprove = bulkApprove.bind(null, employee.email);

  return (
    <div className="container">
      <span className="eyebrow">HOD</span>
      <div className="section-header">
        <h1>{employee.full_name}</h1>
      </div>

      <KpiStrip
        stats={[
          { label: "Awaiting you", value: pending.length },
          { label: "Approved", value: approvedCount },
          { label: "Rejected", value: rejectedCount },
          { label: "Avg. decision time", value: avgApprovalTime(decided) },
        ]}
      />

      <div className="section-header">
        <h2>Awaiting your approval {pending.length > 0 && `(${pending.length})`}</h2>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 28 }}>
        <HodPendingQueue requisitions={pending} bulkApproveAction={boundBulkApprove} />
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
