import Link from "next/link";

export default function CancelledPage() {
  return (
    <div className="container-page py-20 text-center">
      <h1 className="text-3xl font-bold">Checkout cancelled</h1>
      <p className="mt-3 text-muted">No worries, your cart is still saved.</p>
      <Link href="/cart" className="btn-primary mt-8">Return to cart</Link>
    </div>
  );
}
