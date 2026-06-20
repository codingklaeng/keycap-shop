"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken, isAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";

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
  "customer_name,customer_contact," +
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
