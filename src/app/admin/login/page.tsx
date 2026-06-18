"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) router.push("/admin");
    else setError("Incorrect password. Please try again.");
  }

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-12">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-8">
        <h1 className="text-2xl font-bold">Shop admin</h1>
        <p className="text-sm text-muted">Sign in to manage your products, orders, and Etsy sync.</p>
        <div>
          <label htmlFor="pw" className="mb-1 block text-sm font-semibold">Password</label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-soft border border-charcoal/20 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-terracotta">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
