"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const ICONS = {
  home: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 9.5 10 3l7 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5V17h10V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  audit: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h10v14H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  people: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 17c0-3 2-4.8 4.5-4.8s4.5 1.8 4.5 4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12.8 12.6c1.9.4 3.2 1.9 3.2 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="3" width="8" height="14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8h4v9h-4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 6h1M9 6h1M6.5 9h1M9 9h1M6.5 12h1M9 12h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  attendance: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7.5h14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 17V9M10 17V4M16 17v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trends: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M3 15l4.5-5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  payments: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8.5h15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 11.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function NavItem({ href, icon, label, active }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e) {
    // Don't hijack modifier-clicks or middle-click — people expect those
    // to open in a new tab, and preventing default unconditionally would
    // break that.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    startTransition(() => router.push(href));
  }

  return (
    <Link href={href} className="sidebar-item" data-active={active} data-pending={isPending} onClick={handleClick}>
      <span className="sidebar-icon">{isPending ? <span className="inline-spinner" aria-hidden="true" /> : ICONS[icon]}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const is = (p) => pathname === p || pathname.startsWith(p + "/");

  return (
    <nav className="app-sidebar">
      <div className="sidebar-section">
        <NavItem href="/dashboard" icon="home" label="Home" active={pathname === "/dashboard"} />

        {role === "store_manager" && (
          <NavItem href="/requisitions/new" icon="plus" label="Raise Requisition" active={is("/requisitions/new")} />
        )}

        {(role === "hr" || role === "admin") && (
          <>
            <NavItem href="/audit" icon="audit" label="Audit Log" active={is("/audit")} />
            <NavItem href="/attendance" icon="attendance" label="Attendance" active={is("/attendance")} />
            <NavItem href="/payments" icon="payments" label="Payments" active={is("/payments")} />
            <NavItem href="/reports" icon="reports" label="Reports" active={is("/reports")} />
            <NavItem href="/trends" icon="trends" label="Trends" active={is("/trends")} />
          </>
        )}
      </div>

      {role === "admin" && (
        <div className="sidebar-section">
          <div className="sidebar-heading">Admin</div>
          <NavItem href="/admin/people" icon="people" label="People" active={is("/admin/people")} />
          <NavItem href="/admin/vendors" icon="building" label="Vendors" active={is("/admin/vendors")} />
        </div>
      )}
    </nav>
  );
}
