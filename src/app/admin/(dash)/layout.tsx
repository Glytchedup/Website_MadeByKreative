import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { LogoutButton } from "@/components/admin/LogoutButton";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products & inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/sync", label: "Etsy sync" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Shop admin</p>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="block rounded-soft px-3 py-2 text-sm font-medium hover:bg-linen">
            {l.label}
          </Link>
        ))}
        <div className="pt-4"><LogoutButton /></div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
