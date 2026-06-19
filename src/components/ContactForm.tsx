"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const params = useSearchParams();
  const prefill = params.get("message") ?? "";
  const isCustom = params.get("subject") === "Custom banner request";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          message: form.get("message"),
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done")
    return <p className="card p-6 text-pine">Thank you! Your message has been sent. 💛</p>;

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      {isCustom && (
        <p className="rounded-soft bg-cream/60 p-3 text-sm text-muted">
          Your custom-banner details are filled in below, just add your name, email, and anything
          else you&apos;re picturing.
        </p>
      )}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-semibold">Your name</label>
        <input id="name" name="name" required className="w-full rounded-soft border border-charcoal/20 px-3 py-2" />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold">Email</label>
        <input id="email" name="email" type="email" required className="w-full rounded-soft border border-charcoal/20 px-3 py-2" />
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-semibold">Message</label>
        <textarea id="message" name="message" required rows={isCustom ? 8 : 5} defaultValue={prefill} className="w-full rounded-soft border border-charcoal/20 px-3 py-2" />
      </div>
      {status === "error" && <p className="text-sm text-terracotta">Something went wrong. Please try again.</p>}
      <button type="submit" disabled={status === "loading"} className="btn-primary">
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
