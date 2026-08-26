"use client";

import { useFormState, useFormStatus } from "react-dom";

function AssignButton({ compact }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-primary ${compact ? "btn-sm" : ""}`} disabled={pending}>
      {pending ? "Assigning…" : "Assign"}
    </button>
  );
}

export default function VendorAssignForm({ action, vendors, compact = false }) {
  const [state, formAction] = useFormState(action, { error: null });

  if (!vendors || vendors.length === 0) {
    return (
      <p className="hint" style={{ margin: 0 }}>
        No active vendors yet — add one in Admin → Vendors first.
      </p>
    );
  }

  return (
    <form action={formAction} className={compact ? "inline-assign" : ""}>
      {state?.error && (
        <p className="form-error" style={compact ? { margin: "0 8px 0 0", padding: "4px 10px" } : {}}>
          {state.error}
        </p>
      )}
      <select name="vendor_id" defaultValue="" required>
        <option value="" disabled>
          {compact ? "Select vendor" : "Select a vendor"}
        </option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
      <AssignButton compact={compact} />
    </form>
  );
}
