import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import {
  sendReminderEmail,
  sendAttendanceReminderEmail,
  sendAttendanceFrozenEmail,
  sendWeeklyHrSummaryEmail,
} from "@/lib/email";
import { addBusinessDays, isWeekend, todayUTC, totalDaysInclusive } from "@/lib/businessDays";

// Triggered by Vercel Cron (see vercel.json — runs once daily, which is
// both the Hobby-plan frequency limit and genuinely all this needs). No
// user session exists here, so this uses the service-role admin client
// and bypasses RLS entirely by design; it's the one legitimate
// system-level job in this app. Runs three independent jobs each time:
// approval reminders, attendance reminders/freeze, and (once a week) the
// HR summary digest.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const approvalResult = await runApprovalReminders(supabase);
  const attendanceResult = await runAttendanceReminders(supabase);
  const weeklyResult = await runWeeklySummary(supabase);

  return NextResponse.json({ approvalResult, attendanceResult, weeklyResult });
}

// ------------------------------------------------------------
// Job 1: nudge the HOD every 24h a requisition sits pending.
// ------------------------------------------------------------
async function runApprovalReminders(supabase) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("requisitions")
    .select("*")
    .eq("status", "pending_hod_approval")
    .lt("created_at", cutoff)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`);

  if (error) {
    console.error("approval reminders: query failed", error);
    return { error: "Query failed" };
  }

  let sent = 0;
  for (const req of stale || []) {
    try {
      await sendReminderEmail(req);
      await supabase
        .from("requisitions")
        .update({ last_reminder_at: new Date().toISOString() })
        .eq("requisition_id", req.requisition_id);
      await supabase.from("requisition_events").insert({
        requisition_id: req.requisition_id,
        event_type: "reminder_sent",
      });
      sent += 1;
    } catch (e) {
      console.error("approval reminders: failed for", req.requisition_id, e);
    }
  }

  return { checked: stale?.length || 0, sent };
}

// ------------------------------------------------------------
// Job 2: once a requisition's date range ends, nag daily (weekdays
// only) until attendance is fully marked, then lock it after a
// 2-business-day grace period. Nothing happens on weekends — no
// reminder fires, and the grace countdown doesn't advance either.
// ------------------------------------------------------------
async function runAttendanceReminders(supabase) {
  const today = todayUTC();

  if (isWeekend(today)) {
    return { skipped: "weekend" };
  }

  const { data: ended, error } = await supabase
    .from("requisitions")
    .select("*")
    .eq("status", "approved")
    .eq("attendance_frozen", false)
    .lt("to_date", today);

  if (error) {
    console.error("attendance reminders: query failed", error);
    return { error: "Query failed" };
  }

  if (!ended || ended.length === 0) {
    return { checked: 0, reminded: 0, frozen: 0 };
  }

  const ids = ended.map((r) => r.requisition_id);
  const { data: attendanceRows } = await supabase
    .from("requisition_attendance")
    .select("requisition_id")
    .in("requisition_id", ids)
    .not("status", "is", null);

  const markedCountByReq = {};
  for (const row of attendanceRows || []) {
    markedCountByReq[row.requisition_id] = (markedCountByReq[row.requisition_id] || 0) + 1;
  }

  let reminded = 0;
  let frozen = 0;

  for (const req of ended) {
    // Expected = every worker marked for every day in the range — the
    // worker-wise model means this is workers × days, not just days.
    const expectedCells = totalDaysInclusive(req.from_date, req.to_date) * req.number_of_workers;
    const markedCells = markedCountByReq[req.requisition_id] || 0;
    if (markedCells >= expectedCells) continue; // fully marked, nothing to do

    const graceDeadline = addBusinessDays(req.to_date, 2);

    if (today > graceDeadline) {
      // Grace period elapsed — lock it.
      try {
        const { data: updated } = await supabase
          .from("requisitions")
          .update({ attendance_frozen: true, attendance_frozen_at: new Date().toISOString() })
          .eq("requisition_id", req.requisition_id)
          .select()
          .single();
        await supabase.from("requisition_events").insert({
          requisition_id: req.requisition_id,
          event_type: "attendance_frozen",
        });
        await sendAttendanceFrozenEmail(updated || req);
        frozen += 1;
      } catch (e) {
        console.error("attendance freeze: failed for", req.requisition_id, e);
      }
      continue;
    }

    // Still within grace period — remind at most once per day.
    const lastReminder = req.attendance_last_reminder_at;
    const alreadyRemindedToday = lastReminder && lastReminder.slice(0, 10) === today;
    if (alreadyRemindedToday) continue;

    try {
      const businessDaysLeft = countBusinessDaysBetween(today, graceDeadline);
      await sendAttendanceReminderEmail(req, businessDaysLeft);
      await supabase
        .from("requisitions")
        .update({ attendance_last_reminder_at: new Date().toISOString() })
        .eq("requisition_id", req.requisition_id);
      reminded += 1;
    } catch (e) {
      console.error("attendance reminder: failed for", req.requisition_id, e);
    }
  }

  return { checked: ended.length, reminded, frozen };
}

function countBusinessDaysBetween(fromStr, toStr) {
  let count = 0;
  let cursor = fromStr;
  while (cursor < toStr) {
    cursor = addBusinessDays(cursor, 1);
    count += 1;
  }
  return count;
}

// ------------------------------------------------------------
// Job 3: weekly digest to HR, sent once — every Monday — covering
// the preceding 7 days.
// ------------------------------------------------------------
async function runWeeklySummary(supabase) {
  const today = todayUTC();
  const isMonday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  if (!isMonday) {
    return { skipped: "not Monday" };
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sinceLabel = since.slice(0, 10);

  const { data: requisitions, error } = await supabase
    .from("requisitions")
    .select("*")
    .gte("created_at", since);

  if (error) {
    console.error("weekly summary: query failed", error);
    return { error: "Query failed" };
  }

  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorNameById = Object.fromEntries((vendors || []).map((v) => [v.id, v.name]));

  // Store-wise stats
  const byStore = {};
  for (const r of requisitions || []) {
    const key = r.store_name || "Unknown store";
    byStore[key] ||= { store: key, raised: 0, approved: 0, rejected: 0, headcountApproved: 0 };
    byStore[key].raised += 1;
    if (r.status === "approved") {
      byStore[key].approved += 1;
      byStore[key].headcountApproved += r.number_of_workers;
    }
    if (r.status === "rejected") byStore[key].rejected += 1;
  }

  // Vendor-wise stats — vendor assignments that happened in this window,
  // not just requisitions raised in it.
  const { data: vendorAssignedThisWeek } = await supabase
    .from("requisitions")
    .select("vendor_id, number_of_workers")
    .not("vendor_id", "is", null)
    .gte("vendor_assigned_at", since);

  const byVendor = {};
  for (const r of vendorAssignedThisWeek || []) {
    const key = vendorNameById[r.vendor_id] || "Unknown vendor";
    byVendor[key] ||= { vendor: key, assignedCount: 0, headcount: 0 };
    byVendor[key].assignedCount += 1;
    byVendor[key].headcount += r.number_of_workers;
  }

  // Timing: raised → decided (time to address), and decided → vendor
  // assigned (time to deploy), for whatever happened to complete in this
  // window.
  const decided = (requisitions || []).filter((r) => r.hod_action_at);
  const avgTimeToDecision = averageDuration(
    decided.map((r) => new Date(r.hod_action_at) - new Date(r.created_at))
  );

  const { data: deployedThisWeek } = await supabase
    .from("requisitions")
    .select("hod_action_at, vendor_assigned_at")
    .not("vendor_id", "is", null)
    .not("hod_action_at", "is", null)
    .gte("vendor_assigned_at", since);

  const avgTimeToVendor = averageDuration(
    (deployedThisWeek || []).map((r) => new Date(r.vendor_assigned_at) - new Date(r.hod_action_at))
  );

  // Attendance-to-payment turnaround: for workers marked "paid" this week,
  // how long since their requisition's attendance register was fully
  // completed. Needs a join since attendance_completed_at lives on
  // requisitions, not requisition_workers.
  const { data: paidThisWeek } = await supabase
    .from("requisition_workers")
    .select("paid_at, requisitions(attendance_completed_at)")
    .not("paid_at", "is", null)
    .gte("paid_at", since);

  const avgTimeToPayment = averageDuration(
    (paidThisWeek || [])
      .filter((w) => w.requisitions?.attendance_completed_at)
      .map((w) => new Date(w.paid_at) - new Date(w.requisitions.attendance_completed_at))
  );

  try {
    const sent = await sendWeeklyHrSummaryEmail({
      periodLabel: `${sinceLabel} to ${today}`,
      storeStats: Object.values(byStore),
      vendorStats: Object.values(byVendor),
      timing: { avgTimeToDecision, avgTimeToVendor, avgTimeToPayment },
    });
    return { sent, storesCounted: Object.keys(byStore).length };
  } catch (e) {
    console.error("weekly summary: send failed", e);
    return { error: "Send failed" };
  }
}

function averageDuration(msValues) {
  if (msValues.length === 0) return "—";
  const avgMs = msValues.reduce((a, b) => a + b, 0) / msValues.length;
  const hours = avgMs / 3_600_000;
  return hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
}
