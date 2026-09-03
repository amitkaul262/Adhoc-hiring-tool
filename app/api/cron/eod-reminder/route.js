import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { sendEodAttendanceReminderEmail } from "@/lib/email";
import { todayUTC } from "@/lib/businessDays";

// Triggered by Vercel Cron (see vercel.json) at end of day IST — a
// separate schedule from the main daily reminders job, since this one
// needs to fire in the evening, not the morning. Same auth pattern:
// service-role admin client, no user session, one legitimate
// system-level job.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const today = todayUTC();

  // Active right now: approved, not locked, and today falls within the
  // engagement's own date range.
  const { data: requisitions } = await supabase
    .from("requisitions")
    .select("requisition_id, worker_type, store_name, from_date, to_date")
    .eq("status", "approved")
    .eq("attendance_frozen", false)
    .lte("from_date", today)
    .gte("to_date", today);

  const ids = (requisitions || []).map((r) => r.requisition_id);
  if (ids.length === 0) {
    return NextResponse.json({ sent: false, reason: "No active requisitions today" });
  }

  const [{ data: workers }, { data: markedToday }] = await Promise.all([
    supabase.from("requisition_workers").select("id, requisition_id").in("requisition_id", ids),
    supabase
      .from("requisition_attendance")
      .select("requisition_id")
      .in("requisition_id", ids)
      .eq("attendance_date", today)
      .not("status", "is", null),
  ]);

  const workerCountByReq = {};
  for (const w of workers || []) workerCountByReq[w.requisition_id] = (workerCountByReq[w.requisition_id] || 0) + 1;
  const markedCountByReq = {};
  for (const m of markedToday || []) markedCountByReq[m.requisition_id] = (markedCountByReq[m.requisition_id] || 0) + 1;

  const incomplete = (requisitions || [])
    .map((r) => ({
      requisition_id: r.requisition_id,
      worker_type: r.worker_type,
      store_name: r.store_name,
      worker_count: workerCountByReq[r.requisition_id] || 0,
      marked_today: markedCountByReq[r.requisition_id] || 0,
    }))
    .filter((r) => r.worker_count > 0 && r.marked_today < r.worker_count);

  if (incomplete.length === 0) {
    return NextResponse.json({ sent: false, reason: "Everything already marked for today" });
  }

  try {
    await sendEodAttendanceReminderEmail(incomplete);
    return NextResponse.json({ sent: true, count: incomplete.length });
  } catch (e) {
    console.error("eod-reminder: send failed", e);
    return NextResponse.json({ sent: false, error: "Send failed" });
  }
}
