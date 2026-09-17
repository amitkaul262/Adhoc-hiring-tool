"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useToastFormState } from "@/hooks/useToastFormState";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

// Lets the HOD adjust headcount, rate, or dates before deciding — e.g.
// "raised for 10, budget only supports 8." Collapsed by default so it
// doesn't compete visually with the actual approve/reject decision.
export default function EditRequisitionForm({ action, requisition }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useToastFormState(action, { error: null }, "Requisition updated.");

  if (!open) {
    return (
      <button type="button" className="edit-terms-toggle" onClick={() => setOpen(true)}>
        Edit headcount, rate, or dates before deciding →
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-header" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15 }}>Edit requisition terms</h2>
      </div>
      <form action={formAction}>
        {state?.error && <p className="form-error">{state.error}</p>}
        <div className="field-row">
          <div className="field">
            <label htmlFor="number_of_workers">Number of workers</label>
            <input id="number_of_workers" name="number_of_workers" type="number" min="1" step="1" defaultValue={requisition.number_of_workers} required />
          </div>
          <div className="field">
            <label htmlFor="tentative_rate">Rate per day (₹)</label>
            <input id="tentative_rate" name="tentative_rate" type="number" min="0" step="0.01" defaultValue={requisition.tentative_rate} required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="from_date">From</label>
            <input id="from_date" name="from_date" type="date" defaultValue={requisition.from_date} required />
          </div>
          <div className="field">
            <label htmlFor="to_date">To</label>
            <input id="to_date" name="to_date" type="date" defaultValue={requisition.to_date} required />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <SaveButton />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
