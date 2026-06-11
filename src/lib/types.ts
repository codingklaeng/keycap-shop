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
  swatch: string | null;
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
  note: string | null;
  created_at: string;
  base_size: { label: string } | null;
  base_color: { name: string; swatch: string | null } | null;
  pendant: { name: string } | null;
  letters: {
    position: number;
    char: string;
    color: { name: string; swatch: string | null } | null;
  }[];
};

export type Catalog = {
  baseTypes: BaseType[];
  baseSizes: BaseSize[];
  baseColors: BaseColor[];
  baseVariants: BaseVariant[];
  keycapColors: KeycapColor[];
  keycapStock: KeycapStock[];
  pendants: Pendant[];
};

// A single chosen letter in the wizard
export type LetterChoice = {
  position: number;
  char: string;
  keycap_color_id: string | null;
};
