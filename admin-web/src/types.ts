export type AdminRole = "MANAGER" | "STAFF";

export interface AdminInfo {
  id: number;
  username: string;
  role: AdminRole;
  status: string;
  mustChangePassword: boolean;
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
  productName: string;
  quantity: number;
  subtotal: number;
  specsDetail: Record<string, string | string[]>;
}

export interface Order {
  id: number;
  orderNo: string;
  pickupNo: string;
  orderType: "DINE_IN" | "TAKEOUT";
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  paidAt?: string;
  remark?: string;
  phone?: string;
  table?: { id: number; tableNo: string } | null;
  items: OrderItem[];
}

export interface TodayStats {
  revenue: number;
  orderCount: number;
  avgTicket: number;
  pending: number;
  making: number;
  ready: number;
}

export interface TrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}
export interface ProductRank {
  productId: number;
  name: string;
  qty: number;
  amount: number;
}
