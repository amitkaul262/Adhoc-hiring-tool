"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import RoleChip from "./RoleChip";

function ageLabel(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days <= 0) return { text: "Today", cls: "pill-active" };
  if (days === 1) return { text: "1 day waiting", cls: "pill" };
  if (days <= 2) return { text: `${days} days waiting`, cls: "pill" };
  return { text: `${days} days waiting`, cls: "pill-inactive-warn" };
}

function BulkApproveButton({ disabled }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending || disabled}>
      {pending ? "Approving…" : "Approve selected"}
    </button>
  );
}

export default function HodPendingQueue({ requisitions, bulkApproveAction }) {
  const [selected, setSelected] = useState(new Set());
  const [remarks, setRemarks] = useState("");
  const [state, formAction] = useFormState(bulkApproveAction, { error: null });

  const allSelected = requisitions.length > 0 && selected.size === requisitions.length;

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(requisitions.map((r) => r.requisition_id)));
  }

  const rows = useMemo(
    () => requisitions.map((r) => ({ ...r, age: ageLabel(r.created_at) })),
    [requisitions]
  );

  if (requisitions.length === 0) {
    return <div className="queue-empty">Nothing waiting on you right now.</div>;
  }

  return (
    <form action={formAction}>
      {state?.error && <p className="form-error" style={{ margin: "0 16px" }}>{state.error}</p>}
      {state?.approvedCount > 0 && (
        <p style={{ color: "var(--success)", fontWeight: 600, margin: "0 16px 12px" }}>
          Approved {state.approvedCount} requisition{state.approvedCount > 1 ? "s" : ""}.
        </p>
      )}

      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="requisition_ids" value={id} />
      ))}

      <div className="table-scroll">
        <table className="req-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Requisition</th>
              <th>Role</th>
              <th>Store</th>
              <th>Raised by</th>
              <th>Workers</th>
              <th>Waiting</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.requisition_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.requisition_id)}
                    onChange={() => toggleOne(r.requisition_id)}
                    aria-label={`Select ${r.requisition_id}`}
                  />
                </td>
                <td><Link href={`/requisitions/${r.requisition_id}`} className="req-id">{r.requisition_id}</Link></td>
                <td><RoleChip workerType={r.worker_type} /></td>
                <td>{r.store_name || "-"}</td>
                <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{r.raised_by_email}</td>
                <td>{r.number_of_workers}</td>
                <td><span className={`pill ${r.age.cls}`}>{r.age.text}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div style={{ padding: "16px", borderTop: "1px solid var(--border)", marginTop: 8 }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="bulk-remarks">Note for all {selected.size} selected (optional)</label>
            <textarea
              id="bulk-remarks"
              name="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Applies to every requisition you've selected"
            />
          </div>
          <BulkApproveButton disabled={selected.size === 0} />
        </div>
      )}
    </form>
  );
}
