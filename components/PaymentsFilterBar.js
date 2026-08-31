"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

export default function PaymentsFilterBar({ vendors = [], stores = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const hasFilters = ["vendor", "payment_status", "store"].some((k) => searchParams.get(k));

  return (
    <div className="filter-bar" data-pending={isPending}>
      <select value={searchParams.get("vendor") || ""} onChange={(e) => setParam("vendor", e.target.value)} disabled={isPending}>
        <option value="">All vendors</option>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>

      <select value={searchParams.get("payment_status") || ""} onChange={(e) => setParam("payment_status", e.target.value)} disabled={isPending}>
        <option value="">All payment statuses</option>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {stores.length > 0 && (
        <select value={searchParams.get("store") || ""} onChange={(e) => setParam("store", e.target.value)} disabled={isPending}>
          <option value="">All stores</option>
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {isPending && <span className="inline-spinner" aria-label="Updating results" />}

      {hasFilters && !isPending && (
        <button type="button" className="clear-filters" onClick={() => startTransition(() => router.push(pathname))}>
          Clear filters
        </button>
      )}
    </div>
  );
}
