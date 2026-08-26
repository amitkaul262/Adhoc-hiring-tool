import Link from "next/link";
import RoleChip from "./RoleChip";
import StatusBadge from "./StatusBadge";
import VendorAssignForm from "./VendorAssignForm";
import ClickableRow from "./ClickableRow";

export default function HrRequisitionsTable({ requisitions, vendorsById, activeVendors, assignActionFor, showVendorColumn = false }) {
  if (!requisitions || requisitions.length === 0) {
    return <div className="queue-empty">Nothing here.</div>;
  }

  return (
    <div className="table-scroll">
    <table className="req-table">
      <thead>
        <tr>
          <th>Requisition</th>
          <th>Role</th>
          <th>Store</th>
          <th>Function</th>
          <th>Raised by</th>
          <th>Status</th>
          {showVendorColumn && <th>Vendor</th>}
        </tr>
      </thead>
      <tbody>
        {requisitions.map((r) => (
          <ClickableRow key={r.requisition_id} href={`/requisitions/${r.requisition_id}`}>
            <td><Link href={`/requisitions/${r.requisition_id}`} className="req-id">{r.requisition_id}</Link></td>
            <td><RoleChip workerType={r.worker_type} /></td>
            <td>{r.store_name || "-"}</td>
            <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{r.function || "-"}</td>
            <td style={{ fontSize: 12, color: "var(--ink-muted)" }}>{r.raised_by_email}</td>
            <td><StatusBadge status={r.status} /></td>
            {showVendorColumn && (
              <td>
                {r.vendor_id ? (
                  vendorsById?.[r.vendor_id]?.name || "Assigned"
                ) : r.status === "approved" ? (
                  <VendorAssignForm action={assignActionFor(r.requisition_id)} vendors={activeVendors} compact />
                ) : (
                  <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>
                )}
              </td>
            )}
          </ClickableRow>
        ))}
      </tbody>
    </table>
    </div>
  );
}
