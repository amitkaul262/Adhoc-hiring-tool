"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [status, setStatus] = useState("idle"); // idle | redirecting | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGoogleSignIn() {
    setStatus("redirecting");
    setErrorMsg("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Nudges Google's account picker to show fnp.com accounts first.
        // Not a security boundary by itself — access is actually gated by
        // whether the signed-in email exists in employee_master.
        queryParams: { hd: "fnp.com", prompt: "select_account" },
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-mark">AH</div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Adhoc Hiring</h1>
        <p style={{ marginBottom: 24 }}>
          Sign in with your FNP Google account to raise or track manpower requisitions.
        </p>

        {status === "error" && (
          <p className="form-error">{errorMsg || "Couldn't sign in. Try again."}</p>
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
      </div>
    </div>
  );
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
