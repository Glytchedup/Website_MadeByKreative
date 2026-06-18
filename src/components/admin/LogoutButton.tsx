"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
  }
  return (
    <button onClick={logout} className="text-sm text-muted underline hover:text-terracotta">
      Sign out
    </button>
  );
}
