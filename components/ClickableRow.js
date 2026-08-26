"use client";

import { useRouter } from "next/navigation";

// Makes an entire <tr> clickable/navigable, while leaving any interactive
// element inside it (a select, a button, a nested link) working normally —
// those stop the click from bubbling up and triggering navigation too.
export default function ClickableRow({ href, children, ...props }) {
  const router = useRouter();

  function handleClick(e) {
    if (e.target.closest("select, button, a, input, textarea, option")) return;
    router.push(href);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") router.push(href);
  }

  return (
    <tr
      className="clickable-row"
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
