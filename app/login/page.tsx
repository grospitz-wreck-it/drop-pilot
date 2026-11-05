"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Zap, LockKeyhole, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Anmeldung fehlgeschlagen.");
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <a className="brand" href="#"><span className="brand-mark"><Zap size={18} /></span>drop<span>pilot</span><small>BETA</small></a>
        <div className="login-icon"><LockKeyhole size={22} /></div>
        <div className="overline">PERSÖNLICHER ZUGANG</div>
        <h1>Willkommen zurück.</h1>
        <p>Gib deinen persönlichen Zugangsschlüssel ein, um DropPilot zu öffnen.</p>
        <form onSubmit={submit}>
          <label>Zugangsschlüssel<input autoFocus type="password" autoComplete="current-password" value={key} onChange={(event) => setKey(event.target.value)} required /></label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary" type="submit" disabled={busy}>{busy ? "Wird geprüft …" : "DropPilot öffnen"} <ArrowRight size={16} /></button>
        </form>
        <small className="login-foot">Dein Zugang wird über eine sichere, HTTP-only Sitzung geschützt.</small>
      </section>
    </main>
  );
}
