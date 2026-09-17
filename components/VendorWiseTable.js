export default function VendorWiseTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="queue-empty">No payment activity yet.</div>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "8px 16px" }}>
        <div className="table-scroll">
          <table className="req-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Requisitions</th>
                <th>Workers</th>
                <th>Days</th>
                <th>GST</th>
                <th>Base</th>
                <th>GST Amount</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Partial</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vendor_id || "unassigned"}>
                  <td style={{ fontWeight: 600 }}>
                    {r.vendor_name}
                    {!r.vendor_id && <span style={{ color: "var(--ink-faint)", fontWeight: 400, fontSize: 11 }}> (no vendor recorded)</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>{r.requisition_count}</td>
                  <td style={{ textAlign: "center" }}>{r.worker_count}</td>
                  <td style={{ textAlign: "center" }}>{r.total_days}</td>
                  <td style={{ textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
                    {r.gst_percentage !== null ? `${r.gst_percentage}%` : "—"}
                  </td>
                  <td>₹{r.total_base_amount.toLocaleString("en-IN")}</td>
                  <td>₹{r.total_gst_amount.toLocaleString("en-IN")}</td>
                  <td style={{ fontWeight: 600 }}>₹{r.total_amount.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "center" }}>
                    <span className="pill pill-active">{r.paid_count}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="pill">{r.partially_paid_count}</span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className="pill pill-inactive">{r.pending_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
