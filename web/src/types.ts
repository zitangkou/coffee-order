export interface SpecOption {
  label: string;
  extra: number;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  nameEn?: string;
  description?: string;
  flavorNotes?: string;
  origin?: string;
  roastLevel?: string;
  imageUrl?: string;
  price: number;
  specsJson: Record<string, SpecOption[]>;
  isSoldOut: boolean;
  isActive: boolean;
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  products: Product[];
}

export interface Table {
  id: number;
  tableNo: string;
  qrCodeUrl?: string;
  isActive: boolean;
}

export interface Shop {
  id: number;
  name: string;
  slogan?: string;
  logoUrl?: string;
  announcement?: string;
  businessHours?: string;
  acceptOrders: boolean;
  dineInEnabled: boolean;
  takeoutEnabled: boolean;
  packFee: number;
  refundEnabled: boolean;
}

export type OrderStatus =
  | "UNPAID"
  | "PAID"
  | "MAKING"
  | "READY"
  | "COMPLETED"
  | "REFUNDING"
  | "REFUNDED"
  | "CANCELLED";

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  specsDetail: Record<string, string | string[]>;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  orderNo: string;
  pickupNo: string;
  tableId?: number;
  table?: Table;
  orderType: "DINE_IN" | "TAKEOUT";
  status: OrderStatus;
  totalAmount: number;
  packFee: number;
  remark?: string;
  phone?: string;
  paidAt?: string;
  createdAt: string;
  items: OrderItem[];
  refunds?: { id: number; status: string; reason: string }[];
}

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  UNPAID: "待支付",
  PAID: "待接单",
  MAKING: "制作中",
  READY: "待取餐",
  COMPLETED: "已完成",
  REFUNDING: "退款中",
  REFUNDED: "已退款",
  CANCELLED: "已取消",
};
