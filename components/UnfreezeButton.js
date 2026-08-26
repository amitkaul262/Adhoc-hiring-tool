"use client";

import { useFormState, useFormStatus } from "react-dom";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending ? "Unlocking…" : "Unlock register"}
    </button>
  );
}

export default function UnfreezeButton({ action }) {
  const [state, formAction] = useFormState(action, { error: null });
  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {state?.error && <span style={{ color: "var(--danger)", fontSize: 12 }}>{state.error}</span>}
      <Button />
    </form>
  );
}
