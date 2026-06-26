"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const KEY = "mbk_consent_v1";

/**
 * Lightweight cookie-consent banner that gates GA4 analytics cookies via Google
 * Consent Mode. Until the visitor accepts, analytics_storage stays "denied" (set
 * as the default in Analytics), so no _ga cookies are written. The choice is
 * remembered in localStorage. Only rendered when GA is configured.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const choice = localStorage.getItem(KEY);
    if (choice === "granted") {
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    } else if (!choice) {
      setShow(true);
    }
  }, []);

  function decide(granted: boolean) {
    localStorage.setItem(KEY, granted ? "granted" : "denied");
    if (granted) window.gtag?.("consent", "update", { analytics_storage: "granted" });
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-lg border border-black/10 bg-cream p-4 shadow-lg sm:flex sm:items-center sm:gap-4"
    >
      <p className="text-sm text-charcoal/90">
        We use a few cookies to understand what&apos;s loved on the site. You can opt in to
        anonymous analytics, or keep just the essentials. See our{" "}
        <Link href="/privacy" className="font-semibold text-terracotta underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button onClick={() => decide(false)} className="btn-secondary px-3 py-1.5 text-sm">
          Essentials only
        </button>
        <button onClick={() => decide(true)} className="btn-primary px-3 py-1.5 text-sm">
          Accept
        </button>
      </div>
    </div>
  );
}
