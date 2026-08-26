"use client";

function toCsvValue(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ key: "field_name", label: "Column Header" }, ...] — plain
// data only, never functions. This component (and its columns prop) may
// be used from a Server Component tree, and functions can't cross the
// server/client boundary — looking values up by key keeps this safe
// regardless of where it's called from.
function buildCsv(columns, rows) {
  const header = columns.map((c) => toCsvValue(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => toCsvValue(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export default function ExportCsvButton({ filename, columns, rows, label = "Export CSV" }) {
  function handleClick() {
    const csv = buildCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={handleClick} disabled={!rows || rows.length === 0}>
      {label}
    </button>
  );
}
