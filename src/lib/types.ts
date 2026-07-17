export type BaseShape = "rounded_square" | "circle" | "hexagon" | "octagon";

export const BASE_SHAPES: BaseShape[] = ["rounded_square", "circle", "hexagon", "octagon"];

export const BASE_SHAPE_LABEL: Record<BaseShape, string> = {
  rounded_square: "4 เหลี่ยม (ขอบมน)",
  circle: "วงกลม",
  hexagon: "หกเหลี่ยม",
  octagon: "แปดเหลี่ยม",
};

export type BaseType = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  shape: BaseShape;
};

export type BaseSize = {
  id: string;
  base_type_id: string | null;
  max_chars: number; // = จำนวนช่อง
  sort_order: number;
  active: boolean;
};

export type BaseColor = {
  id: string;
  name: string;
  swatch: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

// A sellable product: a (size × color) pairing with its own price/stock/image
export type BaseVariant = {
  id: string;
  base_size_id: string;
  base_color_id: string;
  price: number;
  stock: number;
  reserved: number;
  available: number; // generated: stock - reserved
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export type KeycapColor = {
  id: string;
  name: string;
  base_type_id: string | null; // keycap shape (base type) this color belongs to
  key_color: string; // สีแป้น (keycap background)
  text_color: string; // สีตัวหนังสือ (legend color)
  image_url: string | null;
  price: number;
  sort_order: number;
  active: boolean;
};

export type KeycapStock = {
  id: string;
  char: string;
  color_id: string;
  stock: number;
  reserved: number;
  available: number; // generated: stock - reserved
};

export type SocialPlatform = {
  id: string;
  name: string;
  url_template: string;
  hint: string | null;
  icon: string | null;
  image_url: string | null;
  brand_color: string | null;
  price: number;
  stock: number;
  reserved: number;
  available: number; // generated: stock - reserved
  sort_order: number;
  active: boolean;
};

export type Pendant = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  stock: number;
  reserved: number;
  available: number; // generated: stock - reserved
  sort_order: number;
  active: boolean;
};

// Shopee stock sync (manual-first). See docs/SHOPEE_INTEGRATION.md.
export type ShopeeSource = "base_variants" | "social_platforms";

export type ShopeeItemMap = {
  id: string;
  source_table: ShopeeSource;
  source_id: string;
  shopee_label: string | null;
  shopee_url: string | null;
  shopee_item_id: number | null;
  shopee_model_id: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShopeeStockQueue = {
  id: string;
  source_table: ShopeeSource;
  source_id: string;
  new_stock: number;
  old_stock: number | null;
  status: "pending" | "done";
  created_at: string;
  done_at: string | null;
};

export type OrderStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "picked_up"
  | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "รอคิว",
  in_progress: "กำลังทำ",
  ready: "พร้อมรับ",
  picked_up: "รับแล้ว",
  cancelled: "ยกเลิก",
};

// How an order was created / its sales channel. 'customer' = self-service
// online; the rest are admin-created (e.g. a Shopee sale re-entered by staff).
export type OrderSource =
  | "customer"
  | "shopee"
  | "walk_in"
  | "line"
  | "facebook"
  | "other";

// Channels an admin can pick when creating an order (never 'customer').
export const ADMIN_ORDER_SOURCES: { value: OrderSource; label: string }[] = [
  { value: "shopee", label: "Shopee" },
  { value: "walk_in", label: "หน้าร้าน (walk-in)" },
  { value: "line", label: "LINE" },
  { value: "facebook", label: "Facebook" },
  { value: "other", label: "อื่นๆ" },
];

// Metadata the admin adds on top of a normal order: the sales channel, an
// optional external reference (e.g. Shopee order number), and whether it's
// already paid in full (Shopee orders are prepaid).
export type AdminOrderMeta = {
  source: OrderSource;
  external_ref: string | null;
  markPaid: boolean;
};

// Result of an admin order-create action. Business failures come back as
// { ok: false, code } rather than throwing, so the place_* error code survives
// the server-action boundary and can be translated for display client-side.
export type AdminOrderResult =
  | { ok: true; order_id: string }
  | { ok: false; code: string };

// Link for a Shopee order's external reference. If the admin pasted a full URL,
// use it as-is; otherwise treat it as an order number and build the Seller
// Center order link.
export function shopeeOrderUrl(ref: string): string {
  const r = ref.trim();
  if (/^https?:\/\//i.test(r)) return r;
  return `https://seller.shopee.co.th/portal/sale/order/${encodeURIComponent(r)}`;
}

// Badge shown on the board for admin-created orders (customer orders get none).
export const ORDER_SOURCE_BADGE: Record<
  Exclude<OrderSource, "customer">,
  { label: string; emoji: string }
> = {
  shopee: { label: "Shopee", emoji: "🛒" },
  walk_in: { label: "หน้าร้าน", emoji: "🏪" },
  line: { label: "LINE", emoji: "💬" },
  facebook: { label: "Facebook", emoji: "📘" },
  other: { label: "อื่นๆ", emoji: "🏷️" },
};

export type Order = {
  id: string;
  queue_number: string;
  queue_date: string;
  status: OrderStatus;
  text: string;
  base_size_id: string | null;
  base_color_id: string | null;
  pendant_id: string | null;
  total_price: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// Shape returned by the get_order RPC
export type OrderDetail = {
  id: string;
  queue_number: string;
  status: OrderStatus;
  text: string;
  total_price: number;
  paid_amount: number;
  deposit_required: number;
  note: string | null;
  created_at: string;
  product_type: "keycap" | "nfc" | "nameplate";
  layout: "horizontal" | "vertical" | null;
  customer_name: string | null;
  nfc: {
    platform: string;
    icon: string | null;
    image: string | null;
    value: string;
    url: string;
  } | null;
  nameplate: { text: string; spec: Record<string, unknown> } | null;
  base_shape: BaseShape | null;
  base_size: { label: string } | null;
  base_color: { name: string; swatch: string | null } | null;
  pendant: { name: string } | null;
  letters: {
    position: number;
    char: string;
    color: { name: string; key_color: string; text_color: string } | null;
  }[];
};

export type NameplateColor = {
  id: string;
  name: string;
  swatch: string;
  sort_order: number;
  active: boolean;
};

export type Catalog = {
  baseTypes: BaseType[];
  baseSizes: BaseSize[];
  baseColors: BaseColor[];
  baseVariants: BaseVariant[];
  keycapColors: KeycapColor[];
  keycapStock: KeycapStock[];
  pendants: Pendant[];
  addonPrice: number;
};

// A single chosen letter in the wizard
export type LetterChoice = {
  position: number;
  char: string;
  keycap_color_id: string | null;
};
