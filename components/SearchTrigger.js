"use client";

export default function SearchTrigger() {
  return (
    <button
      type="button"
      className="search-trigger"
      onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
      aria-label="Search"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>Search</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
