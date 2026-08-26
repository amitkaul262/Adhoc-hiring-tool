"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";

const WORKER_TYPES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];

function SubmitButton({ roleCount }) {
  const { pending } = useFormStatus();
  const label =
    roleCount > 1 ? `Raise ${roleCount} requisitions` : "Raise requisition";
  return (
    <button type="submit" className="btn btn-primary" disabled={pending || roleCount === 0}>
      {pending ? "Raising…" : label}
    </button>
  );
}

// Local calendar date, not UTC — new Date().toISOString() can show
// yesterday's date during early-morning IST hours since it converts to
// UTC first, which would wrongly let someone pick a past "from" date.
function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function NewRequisitionForm({ action, employee }) {
  const [state, formAction] = useFormState(action, { error: null });
  const [selectedRoles, setSelectedRoles] = useState([]); // ordered array of worker_type strings
  const [details, setDetails] = useState({}); // { [worker_type]: { number_of_workers, tentative_rate } }
  const today = todayLocal();

  function toggleRole(type) {
    if (selectedRoles.includes(type)) {
      setSelectedRoles((prev) => prev.filter((t) => t !== type));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    } else {
      setSelectedRoles((prev) => [...prev, type]);
      setDetails((prev) => ({ ...prev, [type]: { number_of_workers: "", tentative_rate: "" } }));
    }
  }

  function updateDetail(type, field, value) {
    setDetails((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  const rolesPayload = JSON.stringify(
    selectedRoles.map((type) => ({
      worker_type: type,
      number_of_workers: details[type]?.number_of_workers,
      tentative_rate: details[type]?.tentative_rate,
    }))
  );

  return (
    <form action={formAction} className="card">
      {state?.error && <p className="form-error">{state.error}</p>}

      <input type="hidden" name="roles_json" value={rolesPayload} />

      <div className="field">
        <label>Worker types</label>
        <div className="role-select">
          {WORKER_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className="role-option"
              data-selected={selectedRoles.includes(type)}
              style={{ "--role-color": `var(--role-${type.toLowerCase()})` }}
              onClick={() => toggleRole(type)}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="hint">
          Select every role you need. Each one still becomes its own requisition with its own ID —
          this just lets you raise them together in one go.
        </p>
      </div>

      {selectedRoles.length > 0 && (
        <div className="field">
          <label>Headcount &amp; rate per role</label>
          <div className="role-detail-header">
            <span>Role</span>
            <span>Workers</span>
            <span>Rate (₹/day)</span>
          </div>
          {selectedRoles.map((type) => (
            <div key={type} className="role-detail-row">
              <span className={`role-chip role-${type}`}>{type}</span>
              <input
                type="number"
                min="1"
                aria-label={`Number of ${type} workers`}
                value={details[type]?.number_of_workers ?? ""}
                onChange={(e) => updateDetail(type, "number_of_workers", e.target.value)}
                required
              />
              <input
                type="number"
                min="1"
                step="0.01"
                aria-label={`Tentative rate for ${type}`}
                value={details[type]?.tentative_rate ?? ""}
                onChange={(e) => updateDetail(type, "tentative_rate", e.target.value)}
                required
              />
            </div>
          ))}
        </div>
      )}

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
      <p className="hint" style={{ marginTop: -10, marginBottom: 18 }}>
        This date range applies to every role selected above.
      </p>

      <div className="field">
        <label>Routes to</label>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
          {employee.reports_to_email || "No HOD mapped — contact HR"} for approval · HR is cc&apos;d automatically.
        </p>
      </div>

      <SubmitButton roleCount={selectedRoles.length} />
    </form>
  );
}
