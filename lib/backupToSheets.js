import { createSupabaseAdminClient } from "@/lib/supabaseServer";

// The core operational tables — a full snapshot of these covers every
// requisition's entire lifecycle: raised, decided, staffed, attended,
// paid, plus the full audit trail and the people/vendor directories.
const TABLES = [
  "requisitions",
  "requisition_workers",
  "requisition_attendance",
  "requisition_events",
  "vendors",
  "employee_master",
];

// Headers are derived from the actual data returned, not hard-coded —
// this can never drift out of sync with the real schema as it evolves,
// unlike a maintained column list that someone has to remember to update.
function toSheetShape(name, data) {
  if (!data || data.length === 0) {
    return { name, headers: ["No data yet as of this backup"], rows: [] };
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    })
  );
  return { name, headers, rows };
}

// Snapshots every core table into the backup Google Sheet via the Apps
// Script relay (see apps-script/Code.gs's handleBackupToSheet) — each
// tab is fully replaced, not appended to, so the sheet always reflects
// exactly the current state as of whenever this last ran, not a growing
// history. Called from both daily cron jobs (morning + end of day).
export async function backupToSheets() {
  const supabase = createSupabaseAdminClient();

  const results = await Promise.all(
    TABLES.map((table) => supabase.from(table).select("*").order("created_at", { ascending: true }))
  );

  const sheets = TABLES.map((table, i) => {
    const { data, error } = results[i];
    if (error) {
      console.error(`backupToSheets: query failed for ${table}`, error);
      return { name: table, headers: [`Query failed: ${error.message}`], rows: [] };
    }
    return toSheetShape(table, data);
  });

  try {
    const res = await fetch(process.env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.APPS_SCRIPT_SECRET,
        action: "backup_to_sheet",
        sheets,
      }),
    });
    const result = await res.json();
    if (result.error) {
      console.error("backupToSheets: relay returned error", result.error);
      return { success: false, error: result.error };
    }
    return { success: true, sheets: result.sheets };
  } catch (e) {
    console.error("backupToSheets: relay call failed", e);
    return { success: false, error: e.message };
  }
}
