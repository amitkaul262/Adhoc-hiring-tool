"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useToastFormState } from "@/hooks/useToastFormState";
import ExportCsvButton from "./ExportCsvButton";

const STATUS_LABELS = { pending: "Pending", partially_paid: "Partially paid", paid: "Paid" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save all"}
    </button>
  );
}

const CSV_COLUMNS = [
  { key: "worker", label: "Worker" },
  { key: "requisition_id", label: "Requisition ID" },
  { key: "worker_type", label: "Worker Type" },
  { key: "store", label: "Store" },
  { key: "vendor", label: "Vendor" },
  { key: "gst_percentage", label: "GST %" },
  { key: "days", label: "Effective Days" },
  { key: "rate", label: "Rate/Day" },
  { key: "base_amount", label: "Base Amount" },
  { key: "gst_amount", label: "GST Amount" },
  { key: "amount", label: "Total Amount" },
  { key: "status", label: "Payment Status" },
  { key: "remarks", label: "Remarks" },
];

export default function PaymentsTable({ rows, saveAction, csvRows, csvColumns, readOnly = false }) {
  const [state, formAction] = useToastFormState(saveAction, { error: null, success: false }, "Payment info saved.");
  const [edits, setEdits] = useState(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          rate_per_day: r.rate_per_day ?? "",
          payment_status: r.payment_status,
          payment_remarks: r.payment_remarks || "",
        },
      ])
    )
  );
  const [selected, setSelected] = useState(() => new Set());
  const [bulkRate, setBulkRate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("paid");

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }
  function applyBulkRate() {
    if (bulkRate === "" || isNaN(Number(bulkRate))) return;
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = { ...next[id], rate_per_day: bulkRate };
      return next;
    });
  }
  function applyBulkStatus() {
    setEdits((prev) => {
      const next = { ...prev };
      for (const id of selected) next[id] = { ...next[id], payment_status: bulkStatus };
      return next;
    });
  }

  function updateEdit(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const liveAmounts = useMemo(() => {
    const amounts = {};
    for (const r of rows) {
      const rate = Number(edits[r.id]?.rate_per_day);
      const base = rate > 0 ? Math.round(rate * r.effective_days * 100) / 100 : null;
      const gstPct = r.gst_percentage ?? 0;
      const gst = base !== null ? Math.round(base * (gstPct / 100) * 100) / 100 : null;
      const total = base !== null ? Math.round((base + gst) * 100) / 100 : null;
      amounts[r.id] = { base, gst, total, gstPct };
    }
    return amounts;
  }, [edits, rows]);

  const payload = JSON.stringify(rows.map((r) => ({ id: r.id, ...edits[r.id] })));

  if (rows.length === 0) {
    return <div className="card"><p style={{ margin: 0 }}>No workers match these filters.</p></div>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="payments_json" value={payload} />

      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.success && <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: 16 }}>Saved.</p>}

      {selected.size > 0 && !readOnly && (
        <div className="bulk-toolbar">
          <span className="bulk-count">{selected.size} selected</span>
          <div className="bulk-action">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Rate/day"
              value={bulkRate}
              onChange={(e) => setBulkRate(e.target.value)}
              style={{ width: 90, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={applyBulkRate}>Apply rate</button>
          </div>
          <div className="bulk-action">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={applyBulkStatus}>Apply status</button>
          </div>
          <button type="button" className="bulk-clear" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-scroll">
        <table className="req-table">
          <thead>
            <tr>
              {!readOnly && (
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} aria-label="Select all workers" />
                </th>
              )}
              <th>Worker</th>
              <th>Requisition</th>
              <th>Store</th>
              <th>Vendor</th>
              <th>GST</th>
              <th>Days</th>
              <th>Rate/day</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {!readOnly && (
                  <td>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.worker_name}`} />
                  </td>
                )}
                <td style={{ fontWeight: 600 }}>{r.worker_name}</td>
                <td><Link href={`/requisitions/${r.requisition_id}`} className="req-id">{r.requisition_id}</Link></td>
                <td>{r.store_name || "-"}</td>
                <td>{r.vendor_name || <span style={{ color: "var(--ink-faint)" }}>Not assigned</span>}</td>
                <td style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
                  {r.gst_percentage ? `${r.gst_percentage}%` : "—"}
                </td>
                <td style={{ textAlign: "center" }}>{r.effective_days}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={edits[r.id]?.rate_per_day ?? ""}
                    placeholder={r.suggested_rate ? `₹${r.suggested_rate}` : "Rate"}
                    onChange={(e) => updateEdit(r.id, "rate_per_day", e.target.value)}
                    style={{ width: 90, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 }}
                    aria-label={`Rate per day for ${r.worker_name}`}
                    disabled={readOnly}
                  />
                </td>
                <td style={{ fontWeight: 600 }}>
                  {liveAmounts[r.id]?.total !== null && liveAmounts[r.id]?.total !== undefined ? (
                    <>
                      ₹{liveAmounts[r.id].total.toLocaleString("en-IN")}
                      {liveAmounts[r.id].gstPct > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-faint)" }}>
                          ₹{liveAmounts[r.id].base.toLocaleString("en-IN")} + {liveAmounts[r.id].gstPct}% GST
                        </div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <select
                    value={edits[r.id]?.payment_status ?? "pending"}
                    onChange={(e) => updateEdit(r.id, "payment_status", e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                    disabled={readOnly}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={edits[r.id]?.payment_remarks ?? ""}
                    onChange={(e) => updateEdit(r.id, "payment_remarks", e.target.value)}
                    placeholder="Notes"
                    style={{ width: 140, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                    aria-label={`Remarks for ${r.worker_name}`}
                    disabled={readOnly}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        {!readOnly && <SubmitButton />}
        <ExportCsvButton filename="payments.csv" columns={csvColumns || CSV_COLUMNS} rows={csvRows} />
      </div>
    </form>
  );
}
