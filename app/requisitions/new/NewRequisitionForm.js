"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";

const WORKER_TYPES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Raising requisition…" : "Raise requisition"}
    </button>
  );
}

export default function NewRequisitionForm({ action, employee }) {
  const [state, formAction] = useFormState(action, { error: null });
  const [workerType, setWorkerType] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="card">
      {state?.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label>Worker type</label>
        <input type="hidden" name="worker_type" value={workerType} />
        <div className="role-select">
          {WORKER_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className="role-option"
              data-selected={workerType === type}
              style={{ "--role-color": `var(--role-${type.toLowerCase()})` }}
              onClick={() => setWorkerType(type)}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="hint">This requisition will be raised for one worker type only.</p>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="number_of_workers">Number of workers</label>
          <input id="number_of_workers" name="number_of_workers" type="number" min="1" required />
        </div>
        <div className="field">
          <label htmlFor="tentative_rate">Tentative rate (₹ / day)</label>
          <input id="tentative_rate" name="tentative_rate" type="number" min="1" step="0.01" required />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="from_date">From date</label>
          <input id="from_date" name="from_date" type="date" min={today} required />
        </div>
        <div className="field">
          <label htmlFor="to_date">To date</label>
          <input id="to_date" name="to_date" type="date" min={today} required />
        </div>
      </div>

      <div className="field">
        <label>Routes to</label>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
          {employee.reports_to_email || "No HOD mapped — contact HR"} for approval · HR is cc&apos;d automatically.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
