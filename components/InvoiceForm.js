"use client";

import { useFormStatus } from "react-dom";
import { useToastFormState } from "@/hooks/useToastFormState";

function SaveButton({ label, pendingLabel }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export default function InvoiceForm({ saveAction, uploadAction, initial }) {
  const [saveState, saveFormAction] = useToastFormState(saveAction, { error: null }, "Invoice info saved.");
  const [uploadState, uploadFormAction] = useToastFormState(uploadAction, { error: null }, "File uploaded to Drive.");

  return (
    <div>
      <form action={saveFormAction} style={{ marginBottom: 20 }}>
        {saveState?.error && <p className="form-error">{saveState.error}</p>}
        <div className="field">
          <label htmlFor="invoice_number">Vendor invoice number</label>
          <input id="invoice_number" name="invoice_number" type="text" defaultValue={initial?.invoice_number || ""} placeholder="e.g. INV-2026-0417" />
        </div>
        <SaveButton label="Save invoice number" pendingLabel="Saving…" />
      </form>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="invoice_file">Upload invoice file</label>
        <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
          Uploads straight to the FNP Drive folder — no need to paste a link. Max 4MB.
        </p>
        <form action={uploadFormAction} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          {uploadState?.error && <p className="form-error" style={{ width: "100%" }}>{uploadState.error}</p>}
          {uploadState?.success && <p style={{ width: "100%", color: "var(--success)", fontWeight: 600, margin: 0 }}>Uploaded.</p>}
          <input id="invoice_file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,image/*,application/pdf" required />
          <SaveButton label="Upload to Drive" pendingLabel="Uploading…" />
        </form>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary className="hint" style={{ cursor: "pointer" }}>Or paste a link to a file already stored elsewhere</summary>
        <form action={saveFormAction} style={{ marginTop: 10 }}>
          <input type="hidden" name="invoice_number" value={initial?.invoice_number || ""} />
          <div className="field">
            <label htmlFor="invoice_file_url">File link</label>
            <input id="invoice_file_url" name="invoice_file_url" type="url" defaultValue={initial?.invoice_file_url || ""} placeholder="https://drive.google.com/..." />
          </div>
          <SaveButton label="Save link" pendingLabel="Saving…" />
        </form>
      </details>
    </div>
  );
}
