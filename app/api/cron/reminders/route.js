import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { sendReminderEmail } from "@/lib/email";

// Triggered by Vercel Cron (see vercel.json — runs once daily, which is
// both the Hobby-plan frequency limit and genuinely all this needs, since
// the 24h last_reminder_at check below already prevents duplicate sends
// within a day) — no user session exists here, so this uses the
// service-role admin client and bypasses RLS entirely by design; it's the
// one legitimate system-level job in this app.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from("requisitions")
    .select("*")
    .eq("status", "pending_hod_approval")
    .lt("created_at", cutoff)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`);

  if (error) {
    console.error("reminders cron: query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
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
      console.error("reminders cron: failed for", req.requisition_id, e);
    }
  }

  return NextResponse.json({ checked: stale?.length || 0, sent });
}
