import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const order = await prisma.order.findFirst({ where: { status: "pending" }, orderBy: { createdAt: "desc" }, include: { items: true } });
if (!order) { console.log("No pending order found."); process.exit(1); }
console.log(`Pending order ${order.id} (session ${order.stripeSessionId}), status=${order.status}, total=${order.totalCents}`);
const payload = JSON.stringify({
  id: "evt_sim_" + order.id, object: "event", api_version: "2024-12-18.acacia",
  type: "checkout.session.completed",
  data: { object: {
    id: order.stripeSessionId, object: "checkout.session",
    metadata: { orderId: order.id },
    amount_total: order.totalCents + 550,
    customer_details: { email: "test-buyer@example.com", name: "Test Buyer",
      address: { line1: "123 Test St", city: "Gilbert", state: "AZ", postal_code: "85234", country: "US" } },
  } },
});
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
const res = await fetch("http://localhost:3000/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
console.log("webhook response:", res.status, await res.text());
await new Promise(r => setTimeout(r, 600));
const after = await prisma.order.findUnique({ where: { id: order.id } });
console.log(`order after: status=${after.status}, email=${after.email}, shippingName=${after.shippingName}, total=${after.totalCents}`);
await prisma.$disconnect();
