"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save attendance"}
    </button>
  );
}

function formatDay(d) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

export default function AttendanceForm({ action, dates, existing, sanctioned }) {
  const [state, formAction] = useFormState(action, { error: null, success: false });

  return (
    <form action={formAction} className="card">
      {state?.error && <p className="form-error">{state.error}</p>}
      {state?.success && (
        <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: 18 }}>Attendance saved.</p>
      )}

      <table className="req-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Workers present</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date}>
              <td>{formatDay(date)}</td>
              <td>
                <input
                  type="number"
                  name={`present_${date}`}
                  min="0"
                  max={sanctioned}
                  defaultValue={existing[date] ?? ""}
                  placeholder={`0–${sanctioned}`}
                  style={{ width: 90, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 20 }}>
        <SubmitButton />
      </div>
    </form>
  );
}
