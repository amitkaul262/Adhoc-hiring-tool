"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function NotificationBell({ groups, count }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        type="button"
        className="bell-link"
        aria-label={`${count} items need your attention`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2a5 5 0 0 0-5 5v3.2c0 .5-.2 1-.5 1.4L3 13.5c-.6.7-.1 1.8.8 1.8h12.4c.9 0 1.4-1.1.8-1.8l-1.5-1.9c-.3-.4-.5-.9-.5-1.4V7a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 17a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="bell-badge">{count > 9 ? "9+" : count}</span>
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          {groups.map((g) => (
            <div key={g.label} className="notif-group">
              <div className="notif-group-label">
                {g.label}
                {g.count !== undefined && <span className="notif-count">{g.count}</span>}
              </div>
              {g.items.map((item) => (
                <Link key={item.id} href={item.href} className="notif-item" onClick={() => setOpen(false)}>
                  {item.text}
                </Link>
              ))}
              <Link href={g.moreHref} className="notif-more" onClick={() => setOpen(false)}>
                {g.items.length > 0 ? "View all →" : "View →"}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
