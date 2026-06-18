import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-3 text-muted">The page you&apos;re looking for has wandered off.</p>
      <Link href="/" className="btn-primary mt-8">Back home</Link>
    </div>
  );
}
