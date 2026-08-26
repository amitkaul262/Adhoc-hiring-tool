"use client";

import { useFormState, useFormStatus } from "react-dom";

function ActionButton({ label, pendingLabel, variant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn ${variant}`} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function DecisionForms({ approveAction, rejectAction }) {
  const [approveState, approveFormAction] = useFormState(approveAction, { error: null });
  const [rejectState, rejectFormAction] = useFormState(rejectAction, { error: null });

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Your decision</h2>

      <div className="decision-row" style={{ alignItems: "flex-start" }}>
        <form action={approveFormAction} style={{ flex: 1 }}>
          {approveState?.error && <p className="form-error">{approveState.error}</p>}
          <div className="field">
            <label htmlFor="approve-remarks">Approval note (optional)</label>
            <textarea id="approve-remarks" name="remarks" placeholder="Anything the store manager should know" />
          </div>
          <ActionButton label="Approve" pendingLabel="Approving…" variant="btn-primary" />
        </form>

        <form action={rejectFormAction} style={{ flex: 1 }}>
          {rejectState?.error && <p className="form-error">{rejectState.error}</p>}
          <div className="field">
            <label htmlFor="reject-remarks">Reason for rejection (required)</label>
            <textarea id="reject-remarks" name="remarks" placeholder="e.g. Budget already covered by existing vendor" required />
          </div>
          <ActionButton label="Reject" pendingLabel="Rejecting…" variant="btn-danger" />
        </form>
      </div>
    </div>
  );
}
