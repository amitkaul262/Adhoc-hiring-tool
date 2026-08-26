export default function RoleChip({ workerType }) {
  return <span className={`role-chip role-${workerType}`}>{workerType}</span>;
}
