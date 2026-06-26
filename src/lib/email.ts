import { Resend } from "resend";
import { flags, siteConfig } from "./config";
import { formatPrice } from "./money";

const resend = flags.emailEnabled ? new Resend(process.env.RESEND_API_KEY!) : null;
const FROM = process.env.EMAIL_FROM || "MadeByKreative <onboarding@resend.dev>";

/** Escape user/external text before embedding it in an HTML email body. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // Graceful degradation: log instead of failing when email isn't configured.
    console.log(`\n[email:disabled] To: ${to}\nSubject: ${subject}\n${html}\n`);
    return { id: "console", disabled: true };
  }
  return resend.emails.send({ from: FROM, to, subject, html });
}

export async function sendOrderConfirmation(opts: {
  to: string;
  orderId: string;
  items: { title: string; variant: string; quantity: number; unitPriceCents: number }[];
  totalCents: number;
}) {
  const rows = opts.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity} × ${esc(i.title)} <span style="color:#7A7268">(${esc(i.variant)})</span></td>` +
        `<td align="right">${formatPrice(i.unitPriceCents * i.quantity)}</td></tr>`
    )
    .join("");
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#3A352F">
    <h1 style="color:#B85C38">Thank you for your order! 💛</h1>
    <p>Hi there, your handmade goods from ${siteConfig.name} are confirmed.
       Each piece is made and packed with love by ${siteConfig.maker}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
      <tr><td style="padding-top:12px;border-top:1px solid #eee"><strong>Total</strong></td>
      <td align="right" style="padding-top:12px;border-top:1px solid #eee"><strong>${formatPrice(
        opts.totalCents
      )}</strong></td></tr>
    </table>
    <p>Order ref: <code>${opts.orderId}</code></p>
    <p style="color:#7A7268">We'll email you again when it ships. Questions? Just reply.</p>
  </div>`;
  return send(opts.to, `Your ${siteConfig.name} order is confirmed`, html);
}

export async function sendOversellAlert(opts: {
  orderId: string;
  detail: string;
}) {
  const to = process.env.MAKER_NOTIFICATION_EMAIL || "";
  if (!to) return;
  const html = `
  <div style="font-family:sans-serif;color:#3A352F">
    <h2 style="color:#B85C38">⚠️ Possible oversell, action needed</h2>
    <p>An order may have sold an item that was already gone (likely sold on Etsy too).</p>
    <p><strong>Order:</strong> ${esc(opts.orderId)}</p>
    <p>${esc(opts.detail)}</p>
    <p>Open the admin sync dashboard to review and, if needed, refund the customer.</p>
  </div>`;
  return send(to, `⚠️ MadeByKreative: possible oversell on order ${opts.orderId}`, html);
}

export async function sendShippingNotification(opts: {
  to: string;
  orderId: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const tracking = opts.trackingNumber
    ? `<p>Tracking: <strong>${esc(opts.trackingNumber)}</strong>${
        opts.carrier ? ` (${esc(opts.carrier)})` : ""
      }</p>`
    : "";
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#3A352F">
    <h1 style="color:#B85C38">Your order is on its way! 📦</h1>
    <p>Good news — your handmade goods from ${siteConfig.name} have shipped.</p>
    ${tracking}
    <p>Order ref: <code>${esc(opts.orderId)}</code></p>
    <p style="color:#7A7268">Thank you for supporting handmade. — ${siteConfig.maker}</p>
  </div>`;
  return send(opts.to, `Your ${siteConfig.name} order has shipped`, html);
}

export async function sendRefundConfirmation(opts: { to: string; orderId: string; amountCents: number }) {
  const html = `
  <div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#3A352F">
    <h1 style="color:#B85C38">Your refund has been issued</h1>
    <p>We've refunded ${formatPrice(opts.amountCents)} for order
       <code>${esc(opts.orderId)}</code>. It may take a few business days to appear on your
       statement.</p>
    <p style="color:#7A7268">Questions? Just reply to this email.</p>
  </div>`;
  return send(opts.to, `Your ${siteConfig.name} refund`, html);
}

export async function sendContactMessage(opts: { name: string; email: string; message: string }) {
  const to = process.env.MAKER_NOTIFICATION_EMAIL || "";
  if (!to) return;
  const html = `<div style="font-family:sans-serif">
    <h3>New contact message</h3>
    <p><strong>From:</strong> ${esc(opts.name)} &lt;${esc(opts.email)}&gt;</p>
    <p>${esc(opts.message).replace(/\n/g, "<br>")}</p></div>`;
  return send(to, `New message from ${opts.name}`, html);
}
