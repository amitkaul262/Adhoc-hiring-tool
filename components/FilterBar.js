"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const WORKER_TYPES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];
const STATUSES = [
  { value: "pending_hod_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function FilterBar({ stores = [], functions = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["status", "worker_type", "store", "function", "from", "to"].some((k) => searchParams.get(k));

  return (
    <div className="filter-bar">
      <select value={searchParams.get("status") || ""} onChange={(e) => setParam("status", e.target.value)}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <select value={searchParams.get("worker_type") || ""} onChange={(e) => setParam("worker_type", e.target.value)}>
        <option value="">All roles</option>
        {WORKER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {stores.length > 0 && (
        <select value={searchParams.get("store") || ""} onChange={(e) => setParam("store", e.target.value)}>
          <option value="">All stores</option>
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {functions.length > 0 && (
        <select value={searchParams.get("function") || ""} onChange={(e) => setParam("function", e.target.value)}>
          <option value="">All functions</option>
          {functions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      )}

      <input type="date" value={searchParams.get("from") || ""} onChange={(e) => setParam("from", e.target.value)} aria-label="From date" />
      <input type="date" value={searchParams.get("to") || ""} onChange={(e) => setParam("to", e.target.value)} aria-label="To date" />

      {hasFilters && (
        <button type="button" className="clear-filters" onClick={() => router.push(pathname)}>
          Clear filters
        </button>
      )}
    </div>
  );
}
