import RoleChip from "./RoleChip";
import ClickableRow from "./ClickableRow";
import AttachmentLink from "./AttachmentLink";

const DECISION_CLS = {
  Pending: "pill-inactive",
  Approved: "pill-active",
  Rejected: "pill-inactive-warn",
};
const PAYMENT_META = {
  pending: { label: "Pending", cls: "pill-inactive" },
  partially_paid: { label: "Partial", cls: "pill" },
  paid: { label: "Paid", cls: "pill-active" },
};

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export default function ReportsTable({ rows }) {
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
                <th>Raised</th>
                <th>Decision</th>
                <th>Vendor</th>
                <th>Attendance</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const payment = r.payment_status ? PAYMENT_META[r.payment_status] : null;
                const attendanceLabel = r.decision !== "Approved"
                  ? "—"
                  : r.attendance_frozen
                    ? "Locked"
                    : r.attendance_completed_at
                      ? "Complete"
                      : r.attendance_worker_count === 0
                        ? "Not started"
                        : "In progress";
                return (
                  <ClickableRow key={r.requisition_id} href={`/requisitions/${r.requisition_id}`}>
                    <td className="req-id">{r.requisition_id}</td>
                    <td><RoleChip workerType={r.worker_type} /></td>
                    <td>{r.store_name || "-"}</td>
                    <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{formatDate(r.raised_at)}</td>
                    <td><span className={`pill ${DECISION_CLS[r.decision] || "pill-inactive"}`}>{r.decision}</span></td>
                    <td>{r.vendor_name || <span style={{ color: "var(--ink-faint)" }}>—</span>}</td>
                    <td style={{ fontSize: 12 }}>{attendanceLabel}</td>
                    <td style={{ fontWeight: 600 }}>{r.total_amount > 0 ? `₹${r.total_amount.toLocaleString("en-IN")}` : "—"}</td>
                    <td>{payment ? <span className={`pill ${payment.cls}`}>{payment.label}</span> : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>}</td>
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
