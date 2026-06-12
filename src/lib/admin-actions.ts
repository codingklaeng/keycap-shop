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

// Cancel + restock atomically (via SQL function)
export async function cancelOrder(id: string) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { error } = await sb.rpc("cancel_order", { p_id: id });
  if (error) throw new Error(error.message);
}

const BOARD_SELECT =
  "id,queue_number,status,text,total_price,note,created_at,product_type,layout," +
  "base_sizes(max_chars,base_types(name)),base_colors(name,swatch),pendants(name)," +
  "order_letters(position,char,keycap_colors(name,key_color,text_color))," +
  "order_nfc(social_value,social_url,social_platforms(name,icon))";

// Read today's orders for the shop board (service role; polled by the client).
export async function getTodayOrders(today: string) {
  if (!(await isAdmin())) throw new Error("unauthorized");
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("orders")
    .select(BOARD_SELECT)
    .eq("queue_date", today)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
