"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal } from "@/lib/searchActions";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    function handleGlobalKey(e) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleGlobalKey);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleGlobalKey);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchGlobal(query);
      setResults(r);
      setActiveIndex(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function goTo(href) {
    close();
    router.push(href);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      goTo(results[activeIndex].href);
    }
  }

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={close}>
      <div className="cmdk-box" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by requisition ID, store, or worker name…"
            className="cmdk-input"
          />
          <kbd className="cmdk-esc">Esc</kbd>
        </div>

        <div className="cmdk-results">
          {loading && <div className="cmdk-empty">Searching…</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="cmdk-empty">No matches for &quot;{query}&quot;</div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="cmdk-empty">Type at least 2 characters to search.</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`cmdk-result ${i === activeIndex ? "cmdk-result-active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => goTo(r.href)}
            >
              <div className="cmdk-result-title">{r.title}</div>
              <div className="cmdk-result-subtitle">{r.subtitle}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
