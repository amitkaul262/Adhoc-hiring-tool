"use client";

import { useEffect, useState } from "react";

function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function AttachmentLink({ url, label = "View attachment" }) {
  const [open, setOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const fileId = extractDriveFileId(url);

  useEffect(() => {
    if (!open) return;
    setIframeLoaded(false);
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!url) return null;

  // Only Drive links can be embedded reliably in a popup — anything else
  // (the manual "paste a link" fallback could be any URL) just opens
  // normally, since arbitrary sites often block being framed.
  if (!fileId) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
        {label} →
      </a>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        {label} →
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>Invoice attachment</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--primary)" }}>
                  Open in Drive →
                </a>
                <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Close">
                  ×
                </button>
              </div>
            </div>
            <div className="modal-iframe-wrap">
              <iframe
                src={`https://drive.google.com/file/d/${fileId}/preview`}
                className="modal-iframe"
                allow="autoplay"
                title="Invoice attachment preview"
                onLoad={() => setIframeLoaded(true)}
                style={{ opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.15s" }}
              />
              {!iframeLoaded && (
                <div className="modal-iframe-loading">
                  <span className="inline-spinner" aria-hidden="true" />
                  <span>Loading attachment…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
