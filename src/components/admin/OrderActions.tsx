"use client";

import { useFormStatus } from "react-dom";
import { fulfillOrder, markShipped, refundOrder } from "@/app/admin/(dash)/orders/actions";

function SubmitButton({
  children,
  variant = "default",
  confirm,
}: {
  children: React.ReactNode;
  variant?: "default" | "danger";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={
        "rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 " +
        (variant === "danger"
          ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          : "bg-sage/15 text-sage hover:bg-sage/25")
      }
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** Per-order management actions (fulfill / ship / refund) for the admin orders list. */
export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const canFulfill = status === "paid";
  const canShip = status === "paid" || status === "fulfilled";
  const canRefund = status === "paid" || status === "fulfilled" || status === "shipped";

  if (!canRefund) return null; // refunded / cancelled: nothing to do

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/5 pt-3">
      {canFulfill && (
        <form action={fulfillOrder}>
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton>Mark fulfilled</SubmitButton>
        </form>
      )}

      {canShip && (
        <form action={markShipped} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          <label className="text-xs text-muted">
            <span className="sr-only">Carrier</span>
            <input
              name="carrier"
              placeholder="Carrier (opt.)"
              className="w-28 rounded-md border border-black/10 px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs text-muted">
            <span className="sr-only">Tracking number</span>
            <input
              name="trackingNumber"
              placeholder="Tracking # (opt.)"
              className="w-36 rounded-md border border-black/10 px-2 py-1 text-xs"
            />
          </label>
          <SubmitButton>Mark shipped</SubmitButton>
        </form>
      )}

      <form action={refundOrder}>
        <input type="hidden" name="orderId" value={orderId} />
        <SubmitButton variant="danger" confirm="Refund this order? This issues a Stripe refund and restocks the items.">
          Refund
        </SubmitButton>
      </form>
    </div>
  );
}
