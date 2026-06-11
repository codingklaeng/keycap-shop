import "server-only";
import { cookies } from "next/headers";
import { createHash } from "crypto";

export const ADMIN_COOKIE = "keycap_admin";

// Token derived from the shared password — presence of the correct token in the
// cookie proves the user knew the password. Not user-specific (shared password model).
export function adminToken(): string {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  return createHash("sha256").update(`keycap::${pw}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return !!token && token === adminToken();
}
