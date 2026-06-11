import { createClient } from "@supabase/supabase-js";

// Browser client — uses the public (publishable/anon) key.
// Only allowed to read catalog/orders and call the place_order / get_order RPCs (per RLS).
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
