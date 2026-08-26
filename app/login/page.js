"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-mark">AH</div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Adhoc Hiring</h1>
        <p style={{ marginBottom: 24 }}>
          Sign in with your work email to raise or track manpower requisitions.
        </p>

        {status === "sent" ? (
          <p style={{ color: "var(--success)", fontWeight: 600 }}>
            Check your inbox — we&apos;ve sent {email} a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ textAlign: "left" }}>
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@fnp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {status === "error" && (
              <p className="form-error">
                {errorMsg || "Couldn't send the link. Try again."}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending link…" : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
