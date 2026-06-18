"use client";

import { useState } from "react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "done" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") return <p className="text-sm text-sage">Thanks for subscribing! 💛</p>;

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="nl-email">Email address</label>
      <input
        id="nl-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="min-w-0 flex-1 rounded-soft border border-charcoal/20 bg-white px-3 py-2 text-sm"
      />
      <button type="submit" disabled={status === "loading"} className="btn-primary px-4 py-2 text-sm">
        {status === "loading" ? "…" : "Join"}
      </button>
      {status === "error" && <span className="sr-only">Something went wrong</span>}
    </form>
  );
}
