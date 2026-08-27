import RoleChip from "@/components/RoleChip";
import BackLink from "@/components/BackLink";
import UnfreezeButton from "@/components/UnfreezeButton";
import AttendanceForm from "./AttendanceForm";
import { markAttendance, unfreezeAttendance } from "./actions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS, MOCK_WORKERS, MOCK_WORKER_ATTENDANCE } from "@/lib/mockData";
import { notFound, redirect } from "next/navigation";

// Pure date-string arithmetic — never touches local-timezone Date getters,
// so this can't be off by a day depending on what timezone the server (or
// a local dev machine) happens to run in.
function dateRange(from, to) {
  const dates = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export default async function AttendancePage({ params }) {
  const { employee } = await getCurrentEmployee();

  let requisition, workers, existing;
  if (PREVIEW_MODE) {
    requisition = MOCK_REQUISITIONS.find((r) => r.requisition_id === params.requisitionId);
    workers = MOCK_WORKERS[params.requisitionId] || [];
    existing = MOCK_WORKER_ATTENDANCE[params.requisitionId] || {};
  } else {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("requisitions")
      .select("*")
      .eq("requisition_id", params.requisitionId)
      .single();
    requisition = data;

    if (requisition) {
      const { data: existingWorkers } = await supabase
        .from("requisition_workers")
        .select("*")
        .eq("requisition_id", params.requisitionId)
        .order("slot_number");

      if (!existingWorkers || existingWorkers.length === 0) {
        // First visit to this requisition's register — auto-create one
        // slot per sanctioned worker. Uses the admin client since this is
        // a system-level bootstrap step, not a user-initiated write, and
        // needs to succeed regardless of which role (store manager or
        // HR) happens to open the page first.
        const admin = createSupabaseAdminClient();
        const slots = Array.from({ length: requisition.number_of_workers }, (_, i) => ({
          requisition_id: params.requisitionId,
          slot_number: i + 1,
        }));
        const { data: created } = await admin.from("requisition_workers").insert(slots).select();
        workers = created || [];
      } else {
        workers = existingWorkers;
      }

      const { data: attendanceRows } = await supabase
        .from("requisition_attendance")
        .select("requisition_worker_id, attendance_date, status")
        .eq("requisition_id", params.requisitionId)
        .not("status", "is", null);

      existing = {};
      for (const row of attendanceRows || []) {
        existing[row.requisition_worker_id] ||= {};
        existing[row.requisition_worker_id][row.attendance_date] = row.status;
      }
    }
  }

  if (!requisition) notFound();

  // Attendance is the manager's + HR's responsibility, and only once
  // the requisition is actually approved.
  const canMark =
    employee &&
    requisition.status === "approved" &&
    (requisition.raised_by_email === employee.email || ["hr", "admin"].includes(employee.role));

  if (!canMark) {
    redirect(`/requisitions/${params.requisitionId}`);
  }

  const dates = dateRange(requisition.from_date, requisition.to_date);
  const boundAction = markAttendance.bind(null, requisition.requisition_id, employee.email);
  const unfreezeAction = unfreezeAttendance.bind(null, requisition.requisition_id, employee.email);
  const isFrozen = !!requisition.attendance_frozen;

  return (
    <div className="container" style={{ maxWidth: 900 }}>
        <BackLink href={`/requisitions/${requisition.requisition_id}`} label="Back to requisition" />
        <span className="eyebrow">{requisition.requisition_id}</span>
        <div className="section-header">
          <h1>
            <RoleChip workerType={requisition.worker_type} /> attendance register
          </h1>
        </div>
        <p style={{ marginBottom: 20 }}>
          {requisition.store_name} · {formatRange(requisition.from_date, requisition.to_date)} ·{" "}
          {requisition.number_of_workers} sanctioned
        </p>

        {isFrozen && (
          <div className="card" style={{ marginBottom: 20, background: "var(--danger-tint)", borderColor: "var(--danger)" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--danger)" }}>
              This register is locked
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>
              The grace period after {requisition.to_date} passed without attendance being fully marked.
              {requisition.attendance_frozen_at && ` Locked on ${new Date(requisition.attendance_frozen_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`}
            </p>
            {employee.role === "admin" && (
              <div style={{ marginTop: 12 }}>
                <UnfreezeButton action={unfreezeAction} />
              </div>
            )}
          </div>
        )}

        <AttendanceForm
          action={boundAction}
          dates={dates}
          workers={workers}
          existing={existing}
          requisitionId={requisition.requisition_id}
          readOnly={isFrozen}
        />
    </div>
  );
}

function formatRange(from, to) {
  const opts = { day: "2-digit", month: "short", timeZone: "UTC" };
  return `${new Date(from).toLocaleDateString("en-IN", opts)} – ${new Date(to).toLocaleDateString("en-IN", opts)}`;
}
