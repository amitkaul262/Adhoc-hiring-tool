"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

const ROLES = ["Florist", "Helper", "Rider", "Chef", "Supervisor"];

function LoginInner() {
  const [status, setStatus] = useState("idle"); // idle | redirecting | error
  const [errorMsg, setErrorMsg] = useState("");
  const params = useSearchParams();
  const urlError = params.get("error_description") || params.get("error");

  async function handleGoogleSignIn() {
    setStatus("redirecting");
    setErrorMsg("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "fnp.com", prompt: "select_account" },
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
  }

  const displayError = status === "error" ? errorMsg : urlError;

  return (
    <div className="login-split">
      <div className="login-panel-left">
        <div className="login-dots" aria-hidden="true" />
        <Image src="/fnp-logo.png" alt="FNP" width={70} height={38} priority className="login-left-logo" />

        <div className="login-headline">
          <h1>Adhoc Hiring, without the paper trail.</h1>
          <p className="login-tagline">
            For <strong>stores</strong> that need workers fast.<br />
            For <strong>HODs</strong> who approve on the move.<br />
            For <strong>HR</strong> that stays fully in the loop.
          </p>
        </div>

        <div className="login-roles">
          {ROLES.map((r) => (
            <span key={r} className={`role-chip role-${r}`}>{r}</span>
          ))}
        </div>
      </div>

      <div className="login-panel-right">
        <div className="login-form-box">
          <Image src="/fnp-logo.png" alt="FNP" width={70} height={38} priority style={{ height: 30, width: "auto", marginBottom: 24 }} />
          <span className="eyebrow">Adhoc Hiring Tool</span>
          <h2 style={{ marginTop: 6, marginBottom: 28 }}>Sign in to continue</h2>

          {displayError && (
            <p className="form-error" style={{ textAlign: "left" }}>
              {friendlyError(displayError)}
            </p>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", gap: 10 }}
            onClick={handleGoogleSignIn}
            disabled={status === "redirecting"}
          >
            <GoogleMark />
            {status === "redirecting" ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          <p style={{ marginTop: 20, fontSize: 12, color: "var(--ink-faint)" }}>
            Use your FNP work email. If you sign in and don&apos;t see your dashboard, HR needs to
            add you first.
          </p>
        </div>
      </div>
    </div>
  );
}

function friendlyError(raw) {
  if (/access_denied/i.test(raw)) return "Sign-in was cancelled.";
  return raw;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.97v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.97A9 9 0 0 0 0 9c0 1.45.35 2.83.97 4.05l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .97 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
