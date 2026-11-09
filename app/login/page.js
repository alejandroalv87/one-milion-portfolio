"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Login failed.");
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.assign(next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1><span className="mark">◆</span> Portfolio Terminal</h1>
        <p className="lead">Enter the access password to continue.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" autoFocus autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn" style={{ width: "100%" }} disabled={busy || !password}>
            {busy ? <span className="spin" /> : "Enter"}
          </button>
          {error && <div className="err">{error}</div>}
        </form>
      </div>
    </div>
  );
}
