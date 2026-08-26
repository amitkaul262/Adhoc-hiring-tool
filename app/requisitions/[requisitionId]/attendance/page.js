import Link from "next/link";
import Navbar from "@/components/Navbar";
import RoleChip from "@/components/RoleChip";
import BackLink from "@/components/BackLink";
import AttendanceForm from "./AttendanceForm";
import { markAttendance } from "./actions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS, MOCK_ATTENDANCE } from "@/lib/mockData";
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

  let requisition, existing;
  if (PREVIEW_MODE) {
    requisition = MOCK_REQUISITIONS.find((r) => r.requisition_id === params.requisitionId);
    existing = MOCK_ATTENDANCE[params.requisitionId] || {};
  } else {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("requisitions")
      .select("*")
      .eq("requisition_id", params.requisitionId)
      .single();
    requisition = data;

    const { data: attendanceRows } = await supabase
      .from("requisition_attendance")
      .select("attendance_date, workers_present")
      .eq("requisition_id", params.requisitionId);
    existing = Object.fromEntries((attendanceRows || []).map((r) => [r.attendance_date, r.workers_present]));
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
  const boundAction = markAttendance.bind(null, requisition.requisition_id, employee.email, dates);

  return (
    <>
      <Navbar employee={employee} />
      <div className="container" style={{ maxWidth: 560 }}>
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
        <AttendanceForm
          action={boundAction}
          dates={dates}
          existing={existing}
          sanctioned={requisition.number_of_workers}
        />
      </div>
    </>
  );
}

function formatRange(from, to) {
  const opts = { day: "2-digit", month: "short" };
  return `${new Date(from).toLocaleDateString("en-IN", opts)} – ${new Date(to).toLocaleDateString("en-IN", opts)}`;
}
