"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useToastFormState } from "@/hooks/useToastFormState";
import ExportCsvButton from "@/components/ExportCsvButton";

const STATUS_META = {
  "": { label: "Not marked", short: "—" },
  full_day: { label: "Full Day", short: "F", cls: "status-full" },
  half_day: { label: "Half Day", short: "½", cls: "status-half" },
  absent: { label: "Absent", short: "A", cls: "status-absent" },
  leave: { label: "Leave", short: "L", cls: "status-leave" },
};
const STATUS_VALUE = { full_day: 1, half_day: 0.5, absent: 0, leave: 0 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save register"}
    </button>
  );
}

function dayMeta(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
  const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
  const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  return { weekday, label, isWeekend };
}

export default function AttendanceForm({ action, addWorkerAction, removeWorkerAction, dates, workers, existing, requisitionId, readOnly = false, canManageRoster = false }) {
  const [state, formAction] = useToastFormState(action, { error: null, success: false }, "Register saved.");

  const [values, setValues] = useState(() => {
    const init = {};
    for (const w of workers) {
      init[w.id] = {};
      for (const d of dates) {
        init[w.id][d] = existing?.[w.id]?.[d] || "";
      }
    }
    return init;
  });
  const [names, setNames] = useState(() => Object.fromEntries(workers.map((w) => [w.id, w.worker_name || `Worker ${w.slot_number}`])));

  function setCell(workerId, date, status) {
    setValues((prev) => ({ ...prev, [workerId]: { ...prev[workerId], [date]: status } }));
  }

  const workerTotals = useMemo(() => {
    const totals = {};
    for (const w of workers) {
      totals[w.id] = dates.reduce((sum, d) => sum + (STATUS_VALUE[values[w.id]?.[d]] ?? 0), 0);
    }
    return totals;
  }, [values, workers, dates]);

  const summary = useMemo(() => {
    let markedCells = 0;
    let personDays = 0;
    let counts = { full_day: 0, half_day: 0, absent: 0, leave: 0 };
    for (const w of workers) {
      for (const d of dates) {
        const v = values[w.id]?.[d];
        if (v) {
          markedCells += 1;
          personDays += STATUS_VALUE[v] ?? 0;
          counts[v] = (counts[v] || 0) + 1;
        }
      }
    }
    const totalCells = workers.length * dates.length;
    const rate = totalCells > 0 ? Math.round((personDays / totalCells) * 100) : null;
    return { markedCells, totalCells, personDays, rate, counts };
  }, [values, workers, dates]);

  const attendanceJson = JSON.stringify(
    workers.flatMap((w) =>
      dates
        .filter((d) => values[w.id]?.[d])
        .map((d) => ({ requisition_worker_id: w.id, attendance_date: d, status: values[w.id][d] }))
    )
  );
  const namesJson = JSON.stringify(workers.map((w) => ({ id: w.id, worker_name: names[w.id] })));

  if (workers.length === 0) {
    return <div className="card"><p style={{ margin: 0 }}>No worker slots yet.</p></div>;
  }

  return (
    <form action={formAction} className="card" style={{ padding: 0 }}>
      <input type="hidden" name="attendance_json" value={attendanceJson} />
      <input type="hidden" name="worker_names_json" value={namesJson} />

      <div style={{ padding: "20px 24px 0" }}>
        {state?.error && <p className="form-error">{state.error}</p>}
        {state?.success && (
          <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: 18 }}>Register saved.</p>
        )}
        <p className="hint" style={{ marginTop: 0 }}>
          F = Full Day · ½ = Half Day · A = Absent · L = Leave. Click a cell to cycle through statuses.
        </p>
        {canManageRoster && !readOnly && (
          <div style={{ marginBottom: 4 }}>
            <AddWorkerButton action={addWorkerAction} />
          </div>
        )}
      </div>

      <div className="table-scroll">
        <table className="register-table register-table-grid">
          <thead>
            <tr>
              <th className="register-worker-col">Worker</th>
              {dates.map((date) => {
                const { weekday, label, isWeekend } = dayMeta(date);
                return (
                  <th key={date} data-weekend={isWeekend} className="register-date-col">
                    <div>{label}</div>
                    <div className="register-day">{weekday}</div>
                  </th>
                );
              })}
              <th>Total</th>
              {canManageRoster && !readOnly && <th style={{ width: 36 }}></th>}
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id}>
                <td className="register-worker-col">
                  <input
                    type="text"
                    value={names[w.id] ?? ""}
                    onChange={(e) => setNames((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder={`Worker ${w.slot_number}`}
                    className="register-name-input"
                    disabled={readOnly}
                  />
                </td>
                {dates.map((date) => {
                  const v = values[w.id]?.[date] || "";
                  const meta = STATUS_META[v];
                  return (
                    <td key={date} className="register-date-col">
                      <StatusCell
                        value={v}
                        disabled={readOnly}
                        onChange={(next) => setCell(w.id, date, next)}
                        label={`${names[w.id] || `Worker ${w.slot_number}`} — ${date}`}
                      />
                    </td>
                  );
                })}
                <td className="register-muted" style={{ textAlign: "center", fontWeight: 600 }}>
                  {workerTotals[w.id]}
                </td>
                {canManageRoster && !readOnly && (
                  <td style={{ textAlign: "center" }}>
                    <RemoveWorkerButton
                      action={removeWorkerAction}
                      workerId={w.id}
                      workerName={names[w.id] || `Worker ${w.slot_number}`}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="register-summary-label">
                {summary.markedCells} of {summary.totalCells} cells marked
              </td>
              <td colSpan={dates.length - 1} className="register-summary-value">
                F: {summary.counts.full_day} · ½: {summary.counts.half_day} · A: {summary.counts.absent} · L: {summary.counts.leave}
              </td>
              <td colSpan={canManageRoster && !readOnly ? 3 : 2} className="register-summary-value">
                {summary.rate === null ? "—" : `${summary.rate}% attendance`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", gap: 12 }}>
        {!readOnly && <SubmitButton />}
        <ExportCsvButton
          filename={`${requisitionId || "attendance"}-register.csv`}
          columns={[
            { key: "worker", label: "Worker" },
            { key: "date", label: "Date" },
            { key: "status", label: "Status" },
          ]}
          rows={workers.flatMap((w) =>
            dates.map((d) => ({
              worker: names[w.id] || `Worker ${w.slot_number}`,
              date: d,
              status: STATUS_META[values[w.id]?.[d] || ""].label,
            }))
          )}
          label="Export CSV"
        />
      </div>
    </form>
  );
}

// Cycles through: not marked → Full Day → Half Day → Absent → Leave → not
// marked. One click per step — faster than opening a dropdown for a grid
// this size, and the color coding makes the current state readable at a
// glance without needing to read the letter.
const CYCLE = ["", "full_day", "half_day", "absent", "leave"];

function StatusCell({ value, onChange, disabled, label }) {
  const meta = STATUS_META[value];
  function handleClick() {
    if (disabled) return;
    const next = CYCLE[(CYCLE.indexOf(value) + 1) % CYCLE.length];
    onChange(next);
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`status-cell ${meta.cls || ""}`}
      aria-label={`${label}: ${meta.label}. Click to change.`}
      title={meta.label}
    >
      {meta.short}
    </button>
  );
}

function AddSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "Adding…" : "+ Add worker"}
    </button>
  );
}

// Lets HR correct the roster when fewer (or more) workers were actually
// deployed than sanctioned — e.g. store manager asked for 10, the vendor
// could only supply 8. number_of_workers on the requisition itself is
// untouched, so what was originally asked for stays visible in reports.
function AddWorkerButton({ action }) {
  const [, formAction] = useToastFormState(action, { error: null }, "Worker added.");
  return (
    <form action={formAction}>
      <AddSubmitButton />
    </form>
  );
}

function RemoveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="worker-remove-btn" disabled={pending} aria-label="Remove worker" title="Remove worker">
      {pending ? "…" : "×"}
    </button>
  );
}

// Removing a worker also deletes their attendance rows (cascade on the
// foreign key) — the confirm() is deliberate friction for a destructive,
// hard-to-undo action.
function RemoveWorkerButton({ action, workerId, workerName }) {
  const boundAction = useMemo(() => action.bind(null, workerId), [action, workerId]);
  const [, formAction] = useToastFormState(boundAction, { error: null }, `${workerName} removed.`);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${workerName}? This also deletes their attendance records for this requisition — this can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <RemoveSubmitButton />
    </form>
  );
}
