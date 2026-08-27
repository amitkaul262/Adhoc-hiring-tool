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
  { key: "days", label: "Effective Days" },
  { key: "rate", label: "Rate/Day" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Payment Status" },
  { key: "remarks", label: "Remarks" },
];

export default function PaymentsTable({ rows, saveAction, csvRows, csvColumns }) {
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

  function updateEdit(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  const liveAmounts = useMemo(() => {
    const amounts = {};
    for (const r of rows) {
      const rate = Number(edits[r.id]?.rate_per_day);
      amounts[r.id] = rate > 0 ? Math.round(rate * r.effective_days * 100) / 100 : null;
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

      <div className="table-scroll">
        <table className="req-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Requisition</th>
              <th>Store</th>
              <th>Vendor</th>
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
                <td style={{ fontWeight: 600 }}>{r.worker_name}</td>
                <td><Link href={`/requisitions/${r.requisition_id}`} className="req-id">{r.requisition_id}</Link></td>
                <td>{r.store_name || "-"}</td>
                <td>{r.vendor_name || <span style={{ color: "var(--ink-faint)" }}>Not assigned</span>}</td>
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
                  />
                </td>
                <td style={{ fontWeight: 600 }}>
                  {liveAmounts[r.id] !== null ? `₹${liveAmounts[r.id].toLocaleString("en-IN")}` : "—"}
                </td>
                <td>
                  <select
                    value={edits[r.id]?.payment_status ?? "pending"}
                    onChange={(e) => updateEdit(r.id, "payment_status", e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
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
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
        <SubmitButton />
        <ExportCsvButton filename="payments.csv" columns={csvColumns || CSV_COLUMNS} rows={csvRows} />
      </div>
    </form>
  );
}
