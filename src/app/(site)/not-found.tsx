import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">404</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        The link may be old or the item may have sold out (everything here is handmade in small
        batches). Let&apos;s get you back to something lovely.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Home</Link>
        <Link href="/shop" className="btn-secondary">Browse the shop</Link>
      </div>
    </div>
  );
}
