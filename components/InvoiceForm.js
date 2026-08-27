"use client";

import { useFormState, useFormStatus } from "react-dom";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? "Saving…" : "Save invoice info"}
    </button>
  );
}

export default function InvoiceForm({ action, initial }) {
  const [state, formAction] = useFormState(action, { error: null });

  return (
    <form action={formAction}>
      {state?.error && <p className="form-error">{state.error}</p>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="invoice_number">Vendor invoice number</label>
          <input id="invoice_number" name="invoice_number" type="text" defaultValue={initial?.invoice_number || ""} placeholder="e.g. INV-2026-0417" />
        </div>
        <div className="field">
          <label htmlFor="invoice_file_url">Invoice file link (Drive, etc.)</label>
          <input id="invoice_file_url" name="invoice_file_url" type="url" defaultValue={initial?.invoice_file_url || ""} placeholder="https://drive.google.com/..." />
        </div>
      </div>
      <SaveButton />
    </form>
  );
}
