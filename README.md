# Keycap Studio — ระบบสั่งทำพวงกุญแจคีย์แคป

เว็บแอปจัดการการขายพวงกุญแจคีย์แคปแบบสั่งทำตามชื่อ มี 2 ฝั่ง: ฝั่งลูกค้า (สแกน QR → สั่ง → รับเลขคิว → ติดตามสถานะ) และฝั่งร้าน (กระดานคิว + จัดการสินค้า/สต็อก)

## Stack
- **Next.js 16** (App Router, TypeScript) + **Tailwind v4**
- **Supabase** — Postgres, Realtime, Storage
- Deploy บน **Vercel**

## โครงสร้างหลัก
```
src/
  app/
    page.tsx                หน้าแรก (ปลายทาง QR)
    order/new/              wizard สั่งสินค้า
    order/[id]/             หน้าติดตามสถานะ (realtime)
    admin/login/            ล็อกอินร้าน (รหัสร่วม)
    admin/                  กระดานคิว (realtime)
    admin/items/            จัดการขนาดฐาน/สีฐาน/สีคีย์แคป+สต็อก/ตัวห้อย
  components/               Wizard, OrderStatus, AdminBoard, ItemsManager, ...
  lib/
    supabase/client.ts      browser client (publishable key)
    supabase/admin.ts       server client (service_role, ข้าม RLS)
    admin-actions.ts        login/logout/อัปเดตสถานะ (server actions)
    items-actions.ts        CRUD สินค้า + สต็อก + อัปโหลดรูป (server actions)
    catalog.ts, price.ts, graphemes.ts, types.ts
```

## ฐานข้อมูล (Supabase)
ตาราง: `base_sizes`, `base_colors`, `keycap_colors`, `keycap_stock` (แยกตัวอักษร×สี),
`pendants`, `orders`, `order_letters`, `queue_counters`

ฟังก์ชัน (RPC):
- `place_order(...)` — ยืนยันออเดอร์แบบ transaction: ตรวจ+ตัดสต็อก, ออกเลขคิวรายวัน, คำนวณราคาฝั่งเซิร์ฟเวอร์
- `get_order(id)` — อ่านรายละเอียดออเดอร์ (ไม่ต้องล็อกอิน)

RLS: อ่าน catalog/ออเดอร์ได้สาธารณะ, เขียนผ่าน service_role (หลังบ้าน) หรือ RPC เท่านั้น
Realtime: เปิดบนตาราง `orders`

## การตั้งค่า env
คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable)
- `SUPABASE_SERVICE_ROLE_KEY` (ลับ)
- `ADMIN_PASSWORD` (รหัสผ่านร้าน)

## รันบนเครื่อง
```bash
npm install
npm run dev
```
- ลูกค้า: http://localhost:3000
- ร้าน: http://localhost:3000/admin (รหัสจาก `ADMIN_PASSWORD`)

## ราคา
`ราคา = ราคาขนาดฐาน + บวกราคาสีฐาน + ผลรวมราคาสีของแต่ละตัวอักษร + ราคาตัวห้อย`
คำนวณ real-time ฝั่งลูกค้า และตรวจซ้ำ/ตัดสต็อกฝั่งเซิร์ฟเวอร์ตอนยืนยัน

## QR ของร้าน
ทำ QR code ชี้ไปที่ URL หน้าแรก (เช่น `https://<your-app>.vercel.app/`) ติดไว้หน้าร้าน
ลูกค้าสแกนแล้วเริ่มสั่งได้ทันที
