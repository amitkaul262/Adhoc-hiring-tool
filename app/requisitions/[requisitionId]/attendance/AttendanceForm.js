"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ExportCsvButton from "@/components/ExportCsvButton";

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

function rowStatus(present, sanctioned) {
  if (present === "" || present === null || present === undefined) return { text: "Not marked", cls: "pill-inactive" };
  const n = Number(present);
  if (n <= 0) return { text: "None present", cls: "pill" };
  if (n >= sanctioned) return { text: "Full", cls: "pill-active" };
  return { text: "Partial", cls: "pill" };
}

export default function AttendanceForm({ action, dates, existing, sanctioned, requisitionId }) {
  const [state, formAction] = useFormState(action, { error: null, success: false });
  const [values, setValues] = useState(() =>
    Object.fromEntries(dates.map((d) => [d, existing[d] !== undefined ? String(existing[d]) : ""]))
  );

  const summary = useMemo(() => {
    let markedDays = 0;
    let totalPresent = 0;
    for (const d of dates) {
      const v = values[d];
      if (v !== "") {
        markedDays += 1;
        totalPresent += Number(v) || 0;
      }
    }
    const possiblePersonDays = markedDays * sanctioned;
    const attendanceRate = possiblePersonDays > 0 ? Math.round((totalPresent / possiblePersonDays) * 100) : null;
    return { markedDays, totalDays: dates.length, totalPresent, attendanceRate };
  }, [values, dates, sanctioned]);

  return (
    <form action={formAction} className="card" style={{ padding: 0 }}>
      <div style={{ padding: "20px 24px 0" }}>
        {state?.error && <p className="form-error">{state.error}</p>}
        {state?.success && (
          <p style={{ color: "var(--success)", fontWeight: 600, marginBottom: 18 }}>Register saved.</p>
        )}
      </div>

      <div className="table-scroll">
        <table className="register-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const { weekday, label, isWeekend } = dayMeta(date);
              const v = values[date];
              const absent = v !== "" ? Math.max(sanctioned - Number(v), 0) : null;
              const status = rowStatus(v, sanctioned);
              return (
                <tr key={date} data-weekend={isWeekend}>
                  <td className="register-date">{label}</td>
                  <td className="register-day">{weekday}</td>
                  <td>
                    <input
                      type="number"
                      name={`present_${date}`}
                      min="0"
                      max={sanctioned}
                      value={v}
                      onChange={(e) => setValues((prev) => ({ ...prev, [date]: e.target.value }))}
                      className="register-input"
                      aria-label={`Workers present on ${label}`}
                    />
                  </td>
                  <td className="register-muted">{absent === null ? "—" : absent}</td>
                  <td><span className={`pill ${status.cls}`}>{status.text}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="register-summary-label">
                {summary.markedDays} of {summary.totalDays} days marked
              </td>
              <td className="register-summary-value">{summary.totalPresent} total</td>
              <td colSpan={2} className="register-summary-value">
                {summary.attendanceRate === null ? "—" : `${summary.attendanceRate}% attendance`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", gap: 12 }}>
        <SubmitButton />
        <ExportCsvButton
          filename={`${requisitionId || "attendance"}-register.csv`}
          columns={[
            { label: "Date", get: (r) => r.date },
            { label: "Day", get: (r) => r.weekday },
            { label: "Present", get: (r) => r.present },
            { label: "Absent", get: (r) => r.absent },
            { label: "Status", get: (r) => r.status },
          ]}
          rows={dates.map((date) => {
            const { weekday, label } = dayMeta(date);
            const v = values[date];
            const absent = v !== "" ? Math.max(sanctioned - Number(v), 0) : "";
            return { date: label, weekday, present: v, absent, status: rowStatus(v, sanctioned).text };
          })}
          label="Export CSV"
        />
      </div>
    </form>
  );
}
