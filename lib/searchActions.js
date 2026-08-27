"use server";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { PREVIEW_MODE } from "@/lib/mockData";

// Uses the regular (non-admin) client deliberately — RLS already scopes
// requisition visibility correctly per role (store manager sees own,
// HOD sees routed, HR/admin see everything), so search automatically
// respects the same boundaries without duplicating that logic here.
export async function searchGlobal(query) {
  if (PREVIEW_MODE) return [];
  const q = (query || "").trim();
  if (q.length < 2) return [];

  const supabase = createSupabaseServerClient();
  const escaped = q.replace(/[%_]/g, "\\$&");

  const [{ data: byReq }, { data: byWorker }] = await Promise.all([
    supabase
      .from("requisitions")
      .select("requisition_id, worker_type, store_name, status")
      .or(`requisition_id.ilike.%${escaped}%,store_name.ilike.%${escaped}%`)
      .limit(8),
    supabase
      .from("requisition_workers")
      .select("worker_name, requisition_id, requisitions(worker_type, store_name, status)")
      .ilike("worker_name", `%${escaped}%`)
      .limit(8),
  ]);

  const results = new Map();

  for (const r of byReq || []) {
    results.set(r.requisition_id, {
      id: r.requisition_id,
      title: r.requisition_id,
      subtitle: `${r.worker_type} · ${r.store_name || "—"} · ${r.status}`,
      href: `/requisitions/${r.requisition_id}`,
    });
  }
  for (const w of byWorker || []) {
    if (results.has(w.requisition_id) || !w.requisitions) continue;
    results.set(w.requisition_id, {
      id: w.requisition_id,
      title: `${w.worker_name} — ${w.requisition_id}`,
      subtitle: `${w.requisitions.worker_type} · ${w.requisitions.store_name || "—"} · ${w.requisitions.status}`,
      href: `/requisitions/${w.requisition_id}`,
    });
  }

  return Array.from(results.values()).slice(0, 8);
}
