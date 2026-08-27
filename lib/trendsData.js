import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchWorkerPaymentRows } from "@/lib/paymentsData";

const EFFECTIVE_DAYS = { full_day: 1, half_day: 0.5, absent: 0, leave: 0 };
const WEEKS_BACK = 12;

// Monday of the week containing this date, as "YYYY-MM-DD" — the
// bucketing key every chart below groups by.
function weekStart(dateStr) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function lastNWeekStarts(n) {
  const weeks = [];
  const today = new Date();
  let cursor = weekStart(today.toISOString());
  for (let i = 0; i < n; i++) {
    weeks.unshift(cursor);
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }
  return weeks;
}

function shortLabel(weekStartStr) {
  return new Date(`${weekStartStr}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export async function fetchTrendsData() {
  const supabase = createSupabaseServerClient();

  const [{ data: requisitions }, { data: attendanceRows }, { rows: paymentRows }] = await Promise.all([
    supabase.from("requisitions").select("requisition_id, created_at, hod_action_at, status, from_date"),
    supabase.from("requisition_attendance").select("attendance_date, status").not("status", "is", null),
    fetchWorkerPaymentRows(), // approved requisitions only, one row per worker with amount + from_date
  ]);

  const weeks = lastNWeekStarts(WEEKS_BACK);
  const weekSet = new Set(weeks);

  // 1. Requisitions raised per week
  const raisedByWeek = Object.fromEntries(weeks.map((w) => [w, 0]));
  // 4. Approval speed per week (hours from raised to decided)
  const decisionMsByWeek = Object.fromEntries(weeks.map((w) => [w, []]));

  for (const r of requisitions || []) {
    const wk = weekStart(r.created_at);
    if (weekSet.has(wk)) raisedByWeek[wk] += 1;
    if (r.hod_action_at) {
      const decidedWeek = weekStart(r.hod_action_at);
      if (weekSet.has(decidedWeek)) {
        decisionMsByWeek[decidedWeek].push(new Date(r.hod_action_at) - new Date(r.created_at));
      }
    }
  }

  // 2. Spend per week, bucketed by the week work actually happened
  // (from_date), not when it was raised or paid.
  const spendByWeek = Object.fromEntries(weeks.map((w) => [w, 0]));
  for (const row of paymentRows || []) {
    const wk = weekStart(row.from_date);
    if (weekSet.has(wk)) spendByWeek[wk] += row.amount || 0;
  }

  // 3. Attendance rate per week — of the attendance actually MARKED that
  // week, what share represents someone actually present (full/half day
  // vs absent/leave). Bucketed by the date being marked for, not when
  // the mark was entered.
  const attendanceByWeek = Object.fromEntries(weeks.map((w) => [w, { marked: 0, effective: 0 }]));
  for (const a of attendanceRows || []) {
    const wk = weekStart(a.attendance_date);
    if (!weekSet.has(wk)) continue;
    attendanceByWeek[wk].marked += 1;
    attendanceByWeek[wk].effective += EFFECTIVE_DAYS[a.status] ?? 0;
  }

  return weeks.map((wk) => {
    const dec = decisionMsByWeek[wk];
    const att = attendanceByWeek[wk];
    return {
      week: wk,
      label: shortLabel(wk),
      raised: raisedByWeek[wk],
      spend: Math.round(spendByWeek[wk]),
      avgDecisionHours: dec.length > 0 ? Math.round((dec.reduce((a, b) => a + b, 0) / dec.length / 3_600_000) * 10) / 10 : null,
      attendanceRatePct: att.marked > 0 ? Math.round((att.effective / att.marked) * 100) : null,
    };
  });
}
