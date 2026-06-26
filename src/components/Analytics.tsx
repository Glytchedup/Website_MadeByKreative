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
// Consent Mode: default DENIED so no analytics cookies are set until the visitor
// opts in via the cookie banner (CookieConsent updates this to granted).
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
