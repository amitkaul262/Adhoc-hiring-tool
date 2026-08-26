import Navbar from "@/components/Navbar";
import RoleChip from "@/components/RoleChip";
import AttendanceForm from "./AttendanceForm";
import { markAttendance } from "./actions";
import { getCurrentEmployee } from "@/lib/currentUser";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE, MOCK_REQUISITIONS, MOCK_ATTENDANCE } from "@/lib/mockData";
import { notFound, redirect } from "next/navigation";

function dateRange(from, to) {
  const dates = [];
  let d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
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
        <span className="eyebrow">{requisition.requisition_id}</span>
        <div className="section-header">
          <h1>
            <RoleChip workerType={requisition.worker_type} /> attendance
          </h1>
        </div>
        <p style={{ marginBottom: 20 }}>
          Mark how many of the {requisition.number_of_workers} sanctioned workers were present each day.
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
