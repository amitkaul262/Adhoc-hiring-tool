import RoleChip from "./RoleChip";
import ClickableRow from "./ClickableRow";
import AttachmentLink from "./AttachmentLink";

const STATUS_META = {
  pending: { label: "Pending", cls: "pill-inactive" },
  partially_paid: { label: "Partial", cls: "pill" },
  paid: { label: "Paid", cls: "pill-active" },
};

export default function PaymentsRequisitionTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="queue-empty">No requisitions match these filters.</div>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "8px 16px" }}>
        <div className="table-scroll">
          <table className="req-table">
            <thead>
              <tr>
                <th>Requisition</th>
                <th>Role</th>
                <th>Store</th>
                <th>Vendor</th>
                <th>Workers</th>
                <th>Days</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_META[r.rollup_status];
                return (
                  <ClickableRow key={r.requisition_id} href={`/payments/${r.requisition_id}`}>
                    <td className="req-id">{r.requisition_id}</td>
                    <td><RoleChip workerType={r.worker_type} /></td>
                    <td>{r.store_name || "-"}</td>
                    <td>{r.vendor_name || <span style={{ color: "var(--ink-faint)" }}>Not assigned</span>}</td>
                    <td style={{ textAlign: "center" }}>{r.worker_count}</td>
                    <td style={{ textAlign: "center" }}>{r.total_days}</td>
                    <td style={{ fontWeight: 600 }}>
                      ₹{r.total_amount.toLocaleString("en-IN")}
                      {r.total_gst_amount > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-faint)" }}>
                          incl. ₹{Math.round(r.total_gst_amount).toLocaleString("en-IN")} GST
                        </div>
                      )}
                      {r.rate_missing_count > 0 && (
                        <span style={{ color: "var(--warn)", fontSize: 11, marginLeft: 6 }}>
                          ({r.rate_missing_count} unrated)
                        </span>
                      )}
                    </td>
                    <td><span className={`pill ${status.cls}`}>{status.label}</span></td>
                    <td>
                      {r.invoice_number && <div style={{ fontSize: 12, marginBottom: r.invoice_file_url ? 4 : 0 }}>{r.invoice_number}</div>}
                      {r.invoice_file_url && <AttachmentLink url={r.invoice_file_url} label="View" />}
                      {!r.invoice_number && !r.invoice_file_url && <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>}
                    </td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
