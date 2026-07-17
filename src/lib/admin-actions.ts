"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken, isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_ORDER_SOURCES,
  type OrderStatus,
  type OrderSource,
  type AdminOrderMeta,
  type AdminOrderResult,
} from "@/lib/types";
import type { KeycapOrderPayload } from "@/components/Wizard";
import type { NfcOrderPayload } from "@/components/NfcWizard";
import type { NameplateOrderPayload } from "@/components/NameplateWizard";

export async function login(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD) {
    return { error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ในเซิร์ฟเวอร์" };
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function logout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Record how much the customer has paid so far (admin enters it manually).
export async function setOrderPaid(id: string, amount: number) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const paid = Math.max(0, Math.round(amount * 100) / 100);
  const { error } = await sb.from("orders").update({ paid_amount: paid }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Admin edits a nameplate order's design spec (for print suitability).
export async function saveNameplateSpec(orderId: string, spec: unknown, text: string) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { error } = await sb
    .from("order_nameplate")
    .update({ spec, text })
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  // keep the order's display text in sync with the edited nameplate text
  await sb.from("orders").update({ text }).eq("id", orderId);
}

// Whether the shop is currently taking 3D-nameplate orders.
export async function getNameplateActive(): Promise<boolean> {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { data } = await sb
    .from("nameplate_config")
    .select("active")
    .eq("id", 1)
    .maybeSingle();
  return !!data?.active;
}

// Quick open/close switch for nameplate ordering (e.g. only at weekend markets).
export async function setNameplateActive(active: boolean) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { error } = await sb
    .from("nameplate_config")
    .update({ active })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

// The minimum-deposit % that must be paid before a nameplate goes into production.
export async function getDepositPercent(): Promise<number> {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { data } = await sb
    .from("nameplate_config")
    .select("min_deposit_percent")
    .eq("id", 1)
    .maybeSingle();
  return Number(data?.min_deposit_percent ?? 0);
}

// Cancel + restock atomically (via SQL function)
export async function cancelOrder(id: string) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { error } = await sb.rpc("cancel_order", { p_id: id });
  if (error) throw new Error(error.message);
}

const BOARD_SELECT =
  "id,queue_number,queue_date,status,text,total_price,paid_amount,note,created_at,product_type,layout," +
  "customer_name,customer_contact,source,external_ref," +
  "base_sizes(max_chars,base_types(name)),base_colors(name,swatch),pendants(name)," +
  "order_letters(position,char,keycap_colors(name,key_color,text_color))," +
  "order_nfc(social_value,social_url,social_platforms(name,icon,image_url))," +
  "order_nameplate(text,spec)";

// Read the board: today's orders + every still-unfinished order from any day
// (pending / in_progress / ready) — so overnight 3D-print jobs and no-shows
// never fall off the board when the date rolls over.
export async function getTodayOrders(today: string) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("orders")
    .select(BOARD_SELECT)
    .or(`queue_date.eq.${today},status.in.(pending,in_progress,ready)`)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// --- Admin-created orders (Shopee, walk-in, …) -----------------------------
// These reuse the exact same place_* RPCs as the customer flow (so stock is
// reserved and mirrored to Shopee identically), then stamp the channel flag,
// external reference, and full-payment via the service_role client. Because
// the anon place_* functions never accept a source, customers can't forge it.
//
// Business failures from place_* (out of stock, closed, …) are returned as
// { ok: false, code } — NOT thrown — so the friendly error code survives the
// server-action boundary (Next.js replaces thrown error messages in prod). The
// caller re-throws the code client-side, where the wizard translates it.

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

function assertAdminSource(source: OrderSource) {
  if (!ADMIN_ORDER_SOURCES.some((s) => s.value === source)) {
    throw new Error(`invalid order source: ${source}`);
  }
}

// Stamp source/external_ref (+ paid_amount when prepaid) onto a freshly created
// order. Runs as service_role; place_* has already reserved stock in its own tx.
async function stampAdminOrder(
  sb: SupabaseAdminClient,
  orderId: string,
  totalPrice: number,
  meta: AdminOrderMeta
) {
  const patch: {
    source: OrderSource;
    external_ref: string | null;
    paid_amount?: number;
  } = {
    source: meta.source,
    external_ref: meta.external_ref?.trim() || null,
  };
  if (meta.markPaid) patch.paid_amount = totalPrice;
  const { error } = await sb.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);
}

// Run a place_* RPC then stamp the admin metadata, sharing the create/stamp flow
// across all three product types.
async function createAdminOrder(
  rpc: "place_order" | "place_nfc_order" | "place_nameplate_order",
  payload: KeycapOrderPayload | NfcOrderPayload | NameplateOrderPayload,
  meta: AdminOrderMeta
): Promise<AdminOrderResult> {
  if (!(await isAdmin())) throw new Error("unauthorized");
  assertAdminSource(meta.source);
  const sb = createAdminClient();
  const { data, error } = await sb.rpc(rpc, payload);
  if (error) return { ok: false, code: error.message };
  const { order_id, total_price } = data as { order_id: string; total_price: number };
  await stampAdminOrder(sb, order_id, total_price, meta);
  return { ok: true, order_id };
}

export async function adminCreateKeycapOrder(
  payload: KeycapOrderPayload,
  meta: AdminOrderMeta
): Promise<AdminOrderResult> {
  return createAdminOrder("place_order", payload, meta);
}

export async function adminCreateNfcOrder(
  payload: NfcOrderPayload,
  meta: AdminOrderMeta
): Promise<AdminOrderResult> {
  return createAdminOrder("place_nfc_order", payload, meta);
}

export async function adminCreateNameplateOrder(
  payload: NameplateOrderPayload,
  meta: AdminOrderMeta
): Promise<AdminOrderResult> {
  return createAdminOrder("place_nameplate_order", payload, meta);
}
