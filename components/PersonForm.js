"use client";

import { useFormStatus } from "react-dom";
import { useToastFormState } from "@/hooks/useToastFormState";

const ROLES = [
  { value: "store_manager", label: "Store Manager" },
  { value: "hod", label: "HOD" },
  { value: "hr", label: "HR" },
  { value: "admin", label: "Admin" },
];

function SubmitButton({ label, pendingLabel }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function PersonForm({ action, initial, isEdit = false }) {
  const [state, formAction] = useToastFormState(action, { error: null }, isEdit ? "Person updated." : "Person added.");
  const p = initial || {};

  return (
    <form action={formAction} className="card" style={{ maxWidth: 560 }}>
      {state?.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={p.email || ""}
          disabled={isEdit}
          required
          placeholder="name@fnp.com"
        />
        {isEdit && <p className="hint">Email can&apos;t be changed once requisitions reference it.</p>}
      </div>

      <div className="field">
        <label htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" type="text" defaultValue={p.full_name || ""} required />
      </div>

      <div className="field">
        <label htmlFor="role">Role</label>
        <select id="role" name="role" defaultValue={p.role || "store_manager"} required>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="function">Function</label>
          <input id="function" name="function" type="text" defaultValue={p.function || ""} placeholder="e.g. Retail Operations" />
        </div>
        <div className="field">
          <label htmlFor="cost_center">Cost center</label>
          <input id="cost_center" name="cost_center" type="text" defaultValue={p.cost_center || ""} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="store_name">Store name</label>
          <input id="store_name" name="store_name" type="text" defaultValue={p.store_name || ""} placeholder="Leave blank if not a store manager" />
        </div>
        <div className="field">
          <label htmlFor="store_code">Store code</label>
          <input id="store_code" name="store_code" type="text" defaultValue={p.store_code || ""} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="reports_to_email">Reports to (HOD email)</label>
        <input
          id="reports_to_email"
          name="reports_to_email"
          type="email"
          defaultValue={p.reports_to_email || ""}
          placeholder="Required for store managers — routes their requisitions"
        />
        <p className="hint">This is what decides who a store manager&apos;s requisitions go to for approval.</p>
      </div>

      {isEdit && (
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={p.is_active !== false} style={{ width: "auto" }} />
          <label htmlFor="is_active" style={{ margin: 0 }}>Active</label>
        </div>
      )}

      <SubmitButton label={isEdit ? "Save changes" : "Add person"} pendingLabel={isEdit ? "Saving…" : "Adding…"} />
    </form>
  );
}
