import Link from "next/link";
import RoleChip from "./RoleChip";
import StatusBadge from "./StatusBadge";
import ClickableRow from "./ClickableRow";

export default function RequisitionTable({ requisitions }) {
  if (!requisitions || requisitions.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ margin: 0 }}>No requisitions raised yet.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
    <table className="req-table">
      <thead>
        <tr>
          <th>Requisition</th>
          <th>Worker type</th>
          <th>Workers</th>
          <th>Rate/day</th>
          <th>Duration</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {requisitions.map((r) => (
          <ClickableRow key={r.requisition_id} href={`/requisitions/${r.requisition_id}`}>
            <td>
              <Link href={`/requisitions/${r.requisition_id}`} className="req-id">
                {r.requisition_id}
              </Link>
            </td>
            <td><RoleChip workerType={r.worker_type} /></td>
            <td>{r.number_of_workers}</td>
            <td>₹{r.tentative_rate}</td>
            <td>{formatDate(r.from_date)} → {formatDate(r.to_date)}</td>
            <td><StatusBadge status={r.status} /></td>
          </ClickableRow>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
