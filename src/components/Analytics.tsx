import Script from "next/script";
import { flags } from "@/lib/config";

// GA4 — loads only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set. Ecommerce events
// (begin_checkout, purchase) are dispatched from the cart/success flows.
export function Analytics() {
  if (!flags.analyticsEnabled) return null;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
