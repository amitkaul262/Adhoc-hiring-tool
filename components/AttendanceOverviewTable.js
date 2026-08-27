import RoleChip from "./RoleChip";
import ClickableRow from "./ClickableRow";

function statusFor(row) {
  if (row.frozen) return { label: "Locked", cls: "pill-inactive-warn" };
  if (row.complete) return { label: "Complete", cls: "pill-active" };
  if (row.marked_cells === 0) return { label: "Not started", cls: "pill-inactive" };
  return { label: "In progress", cls: "pill" };
}

function formatRange(from, to) {
  const opts = { day: "2-digit", month: "short", timeZone: "UTC" };
  return `${new Date(from).toLocaleDateString("en-IN", opts)} – ${new Date(to).toLocaleDateString("en-IN", opts)}`;
}

export default function AttendanceOverviewTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="queue-empty">No approved requisitions yet.</div>;
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
                <th>Duration</th>
                <th>Workers</th>
                <th>Marked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = statusFor(r);
                return (
                  <ClickableRow key={r.requisition_id} href={`/requisitions/${r.requisition_id}/attendance`}>
                    <td className="req-id">{r.requisition_id}</td>
                    <td><RoleChip workerType={r.worker_type} /></td>
                    <td>{r.store_name || "-"}</td>
                    <td>{formatRange(r.from_date, r.to_date)}</td>
                    <td style={{ textAlign: "center" }}>{r.worker_count}</td>
                    <td style={{ textAlign: "center" }}>{r.marked_cells} / {r.expected_cells}</td>
                    <td><span className={`pill ${status.cls}`}>{status.label}</span></td>
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
