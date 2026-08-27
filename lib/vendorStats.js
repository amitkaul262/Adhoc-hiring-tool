import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { averageDuration } from "@/lib/businessDays";

const EFFECTIVE_DAYS = { full_day: 1, half_day: 0.5, absent: 0, leave: 0 };

// One vendor's track record: how many requisitions/workers they've been
// assigned, how reliably those workers actually showed up, and how
// quickly they've historically been assigned once a requisition is
// approved (a proxy for how often HR reaches for this vendor first).
export async function fetchVendorStats(vendorId) {
  const supabase = createSupabaseServerClient();

  const { data: requisitions } = await supabase
    .from("requisitions")
    .select("requisition_id, hod_action_at, vendor_assigned_at")
    .eq("vendor_id", vendorId);

  const reqIds = (requisitions || []).map((r) => r.requisition_id);

  const [{ data: workers }, { data: attendanceRows }] = await Promise.all([
    reqIds.length
      ? supabase.from("requisition_workers").select("id, requisition_id").in("requisition_id", reqIds)
      : Promise.resolve({ data: [] }),
    reqIds.length
      ? supabase.from("requisition_attendance").select("status").in("requisition_id", reqIds).not("status", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  let markedCells = 0;
  let effectiveDays = 0;
  for (const a of attendanceRows || []) {
    markedCells += 1;
    effectiveDays += EFFECTIVE_DAYS[a.status] ?? 0;
  }
  const reliabilityPct = markedCells > 0 ? Math.round((effectiveDays / markedCells) * 100) : null;

  const fillTimes = (requisitions || [])
    .filter((r) => r.hod_action_at && r.vendor_assigned_at)
    .map((r) => new Date(r.vendor_assigned_at) - new Date(r.hod_action_at));

  return {
    requisitionCount: (requisitions || []).length,
    workerCount: (workers || []).length,
    reliabilityPct,
    avgFillTime: averageDuration(fillTimes),
  };
}

// Same stats for every active vendor at once — used to enrich the
// vendor-assignment dropdown so HR sees a quick track record right when
// they're choosing who to assign, not after the fact.
export async function fetchAllVendorStats() {
  const supabase = createSupabaseServerClient();

  const [{ data: requisitions }, { data: workers }, { data: attendanceByReq }] = await Promise.all([
    supabase.from("requisitions").select("requisition_id, vendor_id, hod_action_at, vendor_assigned_at").not("vendor_id", "is", null),
    supabase.from("requisition_workers").select("id, requisition_id"),
    supabase.from("requisition_attendance").select("requisition_id, status").not("status", "is", null),
  ]);

  const vendorByReqId = Object.fromEntries((requisitions || []).map((r) => [r.requisition_id, r.vendor_id]));
  const statsByVendor = {};

  function bucket(vendorId) {
    statsByVendor[vendorId] ||= { requisitionCount: 0, workerCount: 0, markedCells: 0, effectiveDays: 0, fillTimes: [] };
    return statsByVendor[vendorId];
  }

  for (const r of requisitions || []) {
    const b = bucket(r.vendor_id);
    b.requisitionCount += 1;
    if (r.hod_action_at && r.vendor_assigned_at) {
      b.fillTimes.push(new Date(r.vendor_assigned_at) - new Date(r.hod_action_at));
    }
  }
  for (const w of workers || []) {
    const vendorId = vendorByReqId[w.requisition_id];
    if (vendorId) bucket(vendorId).workerCount += 1;
  }
  for (const a of attendanceByReq || []) {
    const vendorId = vendorByReqId[a.requisition_id];
    if (!vendorId) continue;
    const b = bucket(vendorId);
    b.markedCells += 1;
    b.effectiveDays += EFFECTIVE_DAYS[a.status] ?? 0;
  }

  const result = {};
  for (const [vendorId, b] of Object.entries(statsByVendor)) {
    result[vendorId] = {
      requisitionCount: b.requisitionCount,
      workerCount: b.workerCount,
      reliabilityPct: b.markedCells > 0 ? Math.round((b.effectiveDays / b.markedCells) * 100) : null,
      avgFillTime: averageDuration(b.fillTimes),
    };
  }
  return result;
}
