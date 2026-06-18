import { redirect } from "next/navigation";
import { isAuthenticated } from "./auth";

// Call at the top of every protected admin page/server action.
export async function requireAdmin() {
  if (!(await isAuthenticated())) redirect("/admin/login");
}
