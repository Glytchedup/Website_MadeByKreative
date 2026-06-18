"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

// Clears the cart once the customer lands on the success page.
export function ClearCartOnSuccess() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // fire GA4 purchase event if present
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "purchase");
    }
  }, [clear]);
  return null;
}
