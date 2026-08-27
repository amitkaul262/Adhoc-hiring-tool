import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { totalDaysInclusive } from "@/lib/businessDays";
import AttendanceOverviewTable from "@/components/AttendanceOverviewTable";
import KpiStrip from "@/components/KpiStrip";
import { redirect } from "next/navigation";

export default async function AttendanceOverviewPage() {
  const { employee } = await getCurrentEmployee();
  if (!["hr", "admin"].includes(employee.role)) {
    redirect("/dashboard");
  }

  const supabase = createSupabaseServerClient();

  const { data: requisitions } = await supabase
    .from("requisitions")
    .select("requisition_id, worker_type, store_name, from_date, to_date, number_of_workers, attendance_frozen")
    .eq("status", "approved")
    .order("to_date", { ascending: false });

  const ids = (requisitions || []).map((r) => r.requisition_id);

  const [{ data: workerCounts }, { data: markedCounts }] = await Promise.all([
    supabase.from("requisition_workers").select("requisition_id").in("requisition_id", ids.length ? ids : [""]),
    supabase.from("requisition_attendance").select("requisition_id").in("requisition_id", ids.length ? ids : [""]).not("status", "is", null),
  ]);

  const workersByReq = {};
  for (const w of workerCounts || []) workersByReq[w.requisition_id] = (workersByReq[w.requisition_id] || 0) + 1;
  const markedByReq = {};
  for (const m of markedCounts || []) markedByReq[m.requisition_id] = (markedByReq[m.requisition_id] || 0) + 1;

  const rows = (requisitions || []).map((r) => {
    const workerCount = workersByReq[r.requisition_id] || 0;
    const expectedCells = workerCount * totalDaysInclusive(r.from_date, r.to_date);
    const markedCells = markedByReq[r.requisition_id] || 0;
    const complete = expectedCells > 0 && markedCells >= expectedCells;
    return {
      requisition_id: r.requisition_id,
      worker_type: r.worker_type,
      store_name: r.store_name,
      from_date: r.from_date,
      to_date: r.to_date,
      worker_count: workerCount,
      expected_cells: expectedCells,
      marked_cells: markedCells,
      complete,
      frozen: r.attendance_frozen,
    };
  });

  const totalRequisitions = rows.length;
  const completeCount = rows.filter((r) => r.complete).length;
  const frozenCount = rows.filter((r) => r.frozen).length;
  const notStartedCount = rows.filter((r) => r.marked_cells === 0).length;

  return (
    <div className="container-wide">
      <span className="eyebrow">HR</span>
      <div className="section-header">
        <h1>Attendance</h1>
      </div>
      <p style={{ marginBottom: 20 }}>
        Every approved requisition, one line each. Open one to mark or review its register.
      </p>

      <KpiStrip
        stats={[
          { label: "Approved requisitions", value: totalRequisitions },
          { label: "Fully marked", value: completeCount },
          { label: "Not started", value: notStartedCount },
          { label: "Locked", value: frozenCount },
        ]}
      />

      <AttendanceOverviewTable rows={rows} />
    </div>
  );
}
