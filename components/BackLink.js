"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function BackLink({ href = "/dashboard", label = "Dashboard" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    startTransition(() => router.push(href));
  }

  return (
    <Link href={href} className="back-link" data-pending={isPending} onClick={handleClick}>
      {isPending ? (
        <span className="inline-spinner" aria-hidden="true" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </Link>
  );
}
