const LABELS = {
  pending_hod_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {LABELS[status] || status}
    </span>
  );
}
