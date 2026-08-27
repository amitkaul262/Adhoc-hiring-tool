// Next.js shows this automatically for every navigation into this route
// group — both <Link> clicks and programmatic router.push() (used by
// ClickableRow) — while the destination page's data is being fetched.
// The shared shell (TopBar + Sidebar in the parent layout) stays put;
// only this content area shows the loading state, so navigation never
// feels like "nothing happened."
export default function Loading() {
  return (
    <div className="container">
      <div className="skeleton-block" style={{ width: 140, height: 14, marginBottom: 10 }} />
      <div className="skeleton-block" style={{ width: 260, height: 28, marginBottom: 28 }} />

      <div className="kpi-strip">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card">
            <div className="skeleton-block" style={{ width: 40, height: 24, marginBottom: 8 }} />
            <div className="skeleton-block" style={{ width: 70, height: 11 }} />
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
