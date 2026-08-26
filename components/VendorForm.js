"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton({ label, pendingLabel }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function VendorForm({ action, initial, isEdit = false }) {
  const [state, formAction] = useFormState(action, { error: null });
  const v = initial || {};

  return (
    <form action={formAction} className="card" style={{ maxWidth: 480 }}>
      {state?.error && <p className="form-error">{state.error}</p>}

      <div className="field">
        <label htmlFor="name">Vendor name</label>
        <input id="name" name="name" type="text" defaultValue={v.name || ""} required />
      </div>
      <div className="field">
        <label htmlFor="contact_name">Contact person</label>
        <input id="contact_name" name="contact_name" type="text" defaultValue={v.contact_name || ""} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="contact_email">Contact email</label>
          <input id="contact_email" name="contact_email" type="email" defaultValue={v.contact_email || ""} />
        </div>
        <div className="field">
          <label htmlFor="contact_phone">Contact phone</label>
          <input id="contact_phone" name="contact_phone" type="tel" defaultValue={v.contact_phone || ""} />
        </div>
      </div>

      {isEdit && (
        <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input id="is_active" name="is_active" type="checkbox" defaultChecked={v.is_active !== false} style={{ width: "auto" }} />
          <label htmlFor="is_active" style={{ margin: 0 }}>Active (shows up for HR to assign)</label>
        </div>
      )}

      <SubmitButton label={isEdit ? "Save changes" : "Add vendor"} pendingLabel={isEdit ? "Saving…" : "Adding…"} />
    </form>
  );
}
