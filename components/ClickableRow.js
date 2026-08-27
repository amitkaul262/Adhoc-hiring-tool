"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Makes an entire <tr> clickable/navigable, while leaving any interactive
// element inside it (a select, a button, a nested link) working normally —
// those stop the click from bubbling up and triggering navigation too.
// While the navigation is in flight, the row dims and the cursor shows
// "progress" — immediate feedback on the exact thing that was clicked,
// on top of the route-level loading skeleton (see (app)/loading.js).
export default function ClickableRow({ href, children, ...props }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(e) {
    if (e.target.closest("select, button, a, input, textarea, option")) return;
    startTransition(() => router.push(href));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") startTransition(() => router.push(href));
  }

  return (
    <tr
      className="clickable-row"
      data-pending={isPending}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`Open ${href}`}
      {...props}
    >
      {children}
    </tr>
  );
}
