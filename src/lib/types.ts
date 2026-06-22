export type BaseType = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
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
  sort_order: number;
  active: boolean;
};

export type Pendant = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  stock: number;
  sort_order: number;
  active: boolean;
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
