import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/cart/ClearCartOnSuccess";

export const dynamic = "force-dynamic";

export default function SuccessPage() {
  return (
    <div className="container-page py-20 text-center">
      <ClearCartOnSuccess />
      <p className="text-5xl">💛</p>
      <h1 className="mt-4 text-3xl font-bold">Thank you for your order!</h1>
      <p className="mx-auto mt-3 max-w-prose text-muted">
        Your handmade goods are confirmed. You&apos;ll get a confirmation email shortly, and another
        when your order ships. Every piece is made and packed with love.
      </p>
      <Link href="/shop" className="btn-primary mt-8">Keep shopping</Link>
    </div>
  );
}
