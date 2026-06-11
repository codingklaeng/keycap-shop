"use client";

import { useActionState } from "react";
import { login } from "@/lib/admin-actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
      >
        <h1 className="text-xl font-bold">เข้าสู่ระบบร้าน</h1>
        <p className="mt-1 text-sm text-muted">สำหรับเจ้าของร้านเท่านั้น</p>

        <input
          type="password"
          name="password"
          placeholder="รหัสผ่านร้าน"
          autoFocus
          className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
        />

        {state?.error && (
          <p className="mt-2 text-sm text-red-600">{state.error}</p>
        )}

        <button
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
