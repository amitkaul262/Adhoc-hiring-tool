export default function KpiStrip({ stats }) {
  return (
    <div className="kpi-strip">
      {stats.map((s) => (
        <div key={s.label} className="kpi-card">
          <div className="kpi-value">{s.value}</div>
          <div className="kpi-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
