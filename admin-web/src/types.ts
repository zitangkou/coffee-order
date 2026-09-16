export type AdminRole = "MANAGER" | "STAFF";

export interface AdminInfo {
  id: number;
  username: string;
  role: AdminRole;
  status: string;
  mustChangePassword: boolean;
}

export interface AdminRecord {
  id: number;
  username: string;
  role: AdminRole;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
}

export interface AuditLog {
  id: number;
  action: string;
  targetType: string;
  targetId?: number | null;
  detail?: string | null;
  createdAt: string;
  admin?: { username: string } | null;
}

export interface ShopSetting {
  id?: number;
  name: string;
  slogan?: string | null;
  announcement?: string | null;
  businessHours?: string | null;
  acceptOrders: boolean;
  dineInEnabled: boolean;
  takeoutEnabled: boolean;
  packFee: number;
  refundEnabled: boolean;
  takeoutPhoneRequired: boolean;
  updatedAt?: string;
}

export interface SystemStatus {
  checkedAt: string;
  database: boolean;
  uptimeSeconds: number;
  memory: { rssBytes: number; totalBytes: number; freeBytes: number };
  disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null;
  latestBackupAt: string | null;
  environment: string;
  printerEnabled: boolean;
  wechat: Record<string, boolean>;
}

export interface MemberSummary {
  id: number;
  nickname: string;
  phone?: string | null;
  phoneVerified: boolean;
  createdAt: string;
  totalSpent: number;
  orderCount: number;
  avgTicket: number;
  refundCount: number;
  lastOrderAt?: string | null;
  recentOrders: Array<{
    id: number;
    orderNo: string;
    createdAt: string;
    totalAmount: number;
    status: string;
    items: Array<{ productName: string; quantity: number }>;
  }>;
}

export interface StatsSummary {
  range: string;
  revenue: number;
  orderCount: number;
  avgTicket: number;
}

export interface Promotion {
  id: number;
  name: string;
  type: "FULL_REDUCTION" | "PERCENT" | "NEW_CUSTOMER" | "MEMBER_DAY";
  config: { threshold?: number; reduction?: number; rate?: number; weekdays?: number[] };
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface StatsOverview {
  startAt: string;
  endAt: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  orderCount: number;
  avgTicket: number;
  refundCount: number;
  refundRate: number;
  dineInCount: number;
  takeoutCount: number;
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
  refundedAt?: string;
  updatedAt?: string;
  remark?: string;
  phone?: string;
  table?: { id: number; tableNo: string } | null;
  items: OrderItem[];
  payments?: PaymentInfo[];
  refunds?: RefundInfo[];
  statusLogs?: Array<{ id: number; status: string; source: string; createdAt: string }>;
  auditLogs?: Array<{ id: number; action: string; detail?: string | null; createdAt: string; admin?: { username: string } | null }>;
}

export interface PaymentInfo {
  id: number;
  amount: number;
  status: string;
  channel: string;
  transactionId?: string | null;
  createdAt: string;
}

export interface RefundInfo {
  id: number;
  reason: string;
  status: string;
  refundAmount?: number | null;
  failureReason?: string | null;
  rejectReason?: string | null;
  createdAt: string;
  updatedAt: string;
  handledAt?: string | null;
  admin?: { username: string } | null;
}

export interface OrderFilters {
  status?: string;
  keyword?: string;
  orderType?: string;
  tableId?: number;
  startAt?: string;
  endAt?: string;
  page?: number;
  pageSize?: number;
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

export interface SpecOption {
  id?: number;
  label: string;
  extraPrice: number;
  isDefault: boolean;
  sortOrder?: number;
}

export interface SpecGroup {
  id: number;
  name: string;
  type: "SINGLE" | "MULTI";
  required?: boolean;
  sortOrder: number;
  options: SpecOption[];
  _count?: { products: number };
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  products?: Product[];
}

export interface Product {
  id: number;
  categoryId: number;
  category?: Pick<Category, "id" | "name">;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  flavorNotes?: string | null;
  origin?: string | null;
  roastLevel?: string | null;
  imageUrl?: string | null;
  price: number;
  isSignature: boolean;
  isHot: boolean;
  isSoldOut: boolean;
  soldOutUntil?: string | null;
  isActive: boolean;
  sortOrder: number;
  specGroups: SpecGroup[];
}

export interface TableInfo {
  id: number;
  tableNo: string;
  qrCodeUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}
