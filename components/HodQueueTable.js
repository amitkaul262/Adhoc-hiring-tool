import Link from "next/link";
import RoleChip from "./RoleChip";
import StatusBadge from "./StatusBadge";

export default function HodQueueTable({ requisitions, emptyLabel }) {
  if (!requisitions || requisitions.length === 0) {
    return <div className="queue-empty">{emptyLabel || "Nothing here."}</div>;
  }

  return (
    <div className="table-scroll">
    <table className="req-table">
      <thead>
        <tr>
          <th>Requisition</th>
          <th>Role</th>
          <th>Store</th>
          <th>Raised by</th>
          <th>Workers</th>
          <th>Duration</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {requisitions.map((r) => (
          <tr key={r.requisition_id}>
            <td><Link href={`/requisitions/${r.requisition_id}`} className="req-id">{r.requisition_id}</Link></td>
            <td><RoleChip workerType={r.worker_type} /></td>
            <td>{r.store_name || "-"}</td>
            <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{r.raised_by_email}</td>
            <td>{r.number_of_workers}</td>
            <td>{formatDate(r.from_date)} → {formatDate(r.to_date)}</td>
            <td><StatusBadge status={r.status} /></td>
          </tr>
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
