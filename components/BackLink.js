import Link from "next/link";

export default function BackLink({ href = "/dashboard", label = "Dashboard" }) {
  return (
    <Link href={href} className="back-link">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
