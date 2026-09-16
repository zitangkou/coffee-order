import { http } from "./http";
import type {
  AdminInfo,
  AdminRecord,
  AuditLog,
  Category,
  Order,
  OrderFilters,
  Product,
  ProductRank,
  SpecGroup,
  ShopSetting,
  SystemStatus,
  MemberSummary,
  StatsSummary,
  Promotion,
  StatsOverview,
  TableInfo,
  TodayStats,
  TrendPoint,
} from "../types";

export const api = {
  login: (username: string, password: string) =>
    http<{ token: string; admin: AdminInfo }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  changePassword: (oldPassword: string, newPassword: string) =>
    http<{ token: string; mustChangePassword: boolean }>("/admin/password", {
      method: "PUT",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  admins: () => http<AdminRecord[]>("/admin/admins"),
  createAdmin: (data: { username: string; password: string; role: string }) =>
    http<AdminRecord>("/admin/admins", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAdmin: (id: number, data: Record<string, unknown>) =>
    http<AdminRecord>(`/admin/admins/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  auditLogs: (limit = 100) => http<AuditLog[]>(`/admin/audit-logs?limit=${limit}`),
  settings: () => http<ShopSetting | null>("/admin/settings"),
  updateSettings: (data: ShopSetting) =>
    http<ShopSetting>("/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
  systemStatus: () => http<SystemStatus>("/admin/system/status"),
  testPrinter: () => http<{ sent: boolean }>("/admin/printer/test", { method: "POST" }),
  members: (keyword = "", page = 1, pageSize = 20) =>
    http<{ list: MemberSummary[]; total: number; page: number; pageSize: number }>(
      `/admin/members?keyword=${encodeURIComponent(keyword)}&page=${page}&pageSize=${pageSize}`,
    ),
  statsSummary: (range = "today") => http<StatsSummary>(`/admin/stats/summary?range=${range}`),
  hourlyStats: (startAt?: string, endAt?: string) =>
    http<Array<{ hour: string; count: number }>>(
      startAt && endAt
        ? `/admin/stats/hours?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
        : "/admin/stats/hours",
    ),
  categoryStats: (range = "today", startAt?: string, endAt?: string) =>
    http<Array<{ name: string; revenue: number; qty: number }>>(
      startAt && endAt
        ? `/admin/stats/categories?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
        : `/admin/stats/categories?range=${range}`,
    ),
  statsOverview: (startAt: string, endAt: string) =>
    http<StatsOverview>(`/admin/stats/overview?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`),
  promotions: () => http<Promotion[]>("/admin/promotions"),
  createPromotion: (data: Record<string, unknown>) =>
    http<Promotion>("/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
  updatePromotion: (id: number, data: Record<string, unknown>) =>
    http<Promotion>(`/admin/promotions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePromotion: (id: number) => http<null>(`/admin/promotions/${id}`, { method: "DELETE" }),
  today: () => http<TodayStats>("/admin/stats/today"),
  alerts: () => http<{ failedRefunds: number; overduePaid: number; overdueMaking: number; paymentFailures: number }>("/admin/alerts"),
  trend: (days = 7) => http<TrendPoint[]>(`/admin/stats/trend?days=${days}`),
  productsRank: (range = "today", startAt?: string, endAt?: string) =>
    http<ProductRank[]>(
      startAt && endAt
        ? `/admin/stats/products?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
        : `/admin/stats/products?range=${range}`,
    ),
  refundStats: (range = "today") =>
    http<{ count: number; amount: number }>(
      `/admin/stats/refunds?range=${range}`,
    ),
  orders: (params: OrderFilters = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    return http<{ list: Order[]; total: number; page: number; pageSize: number }>(
      `/admin/orders?${query}`,
    );
  },
  order: (id: number) => http<Order>(`/admin/orders/${id}`),
  updateOrderStatus: (id: number, status: string) =>
    http<Order>(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  reprintOrder: (id: number) =>
    http<null>(`/admin/orders/${id}/print`, { method: "POST" }),
  refunds: () => http<any[]>("/admin/refunds"),
  handleRefund: (
    id: number,
    action: "approved" | "rejected",
    rejectReason = "",
  ) =>
    http<any>(`/admin/refunds/${id}`, {
      method: "PUT",
      body: JSON.stringify({ action, rejectReason }),
    }),
  syncRefund: (id: number) =>
    http<any>(`/admin/refunds/${id}/sync`, { method: "POST" }),
  categories: () => http<Category[]>("/admin/categories"),
  createCategory: (data: Pick<Category, "name" | "sortOrder">) =>
    http<Category>("/admin/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reorderCategories: (ids: number[]) =>
    http<{ count: number }>("/admin/categories/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
  updateCategory: (id: number, data: Partial<Category>) =>
    http<Category>(`/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) =>
    http<null>(`/admin/categories/${id}`, { method: "DELETE" }),
  products: (
    params: { keyword?: string; categoryId?: number; status?: string } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.categoryId) query.set("categoryId", String(params.categoryId));
    if (params.status) query.set("status", params.status);
    return http<Product[]>(`/admin/products?${query}`);
  },
  createProduct: (data: Record<string, unknown>) =>
    http<Product>("/admin/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProduct: (id: number, data: Record<string, unknown>) =>
    http<Product>(`/admin/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setSoldOut: (id: number, soldOut: boolean, soldOutUntil?: string | null) =>
    http<Product>(`/admin/products/${id}/sold-out`, {
      method: "PATCH",
      body: JSON.stringify({ soldOut, soldOutUntil }),
    }),
  batchUpdateProducts: (ids: number[], data: Record<string, unknown>) =>
    http<{ count: number }>("/admin/products/batch", {
      method: "PATCH",
      body: JSON.stringify({ ids, ...data }),
    }),
  reorderProducts: (ids: number[]) =>
    http<{ count: number }>("/admin/products/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
  uploadProductImage: (id: number, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return http<Product>(`/admin/products/${id}/image`, {
      method: "POST",
      body,
    });
  },
  specGroups: () => http<SpecGroup[]>("/admin/spec-groups"),
  createSpecGroup: (data: Record<string, unknown>) =>
    http<SpecGroup>("/admin/spec-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSpecGroup: (id: number, data: Record<string, unknown>) =>
    http<SpecGroup>(`/admin/spec-groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSpecGroup: (id: number) =>
    http<null>(`/admin/spec-groups/${id}`, { method: "DELETE" }),
  tables: () => http<TableInfo[]>("/admin/tables"),
  createTable: (tableNo: string) =>
    http<TableInfo>("/admin/tables", {
      method: "POST",
      body: JSON.stringify({ tableNo }),
    }),
  updateTable: (id: number, data: Partial<TableInfo>) =>
    http<TableInfo>(`/admin/tables/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  generateTableCode: (id: number) =>
    http<{ qrUrl: string; scene: string; tableNo: string }>(
      `/admin/tables/${id}/miniprogram-code`,
      { method: "POST" },
    ),
  generateTakeoutCode: () =>
    http<{ qrUrl: string; scene: string }>("/admin/takeout-miniprogram-code", {
      method: "POST",
    }),
  generateTableCodes: (ids: number[]) =>
    http<Array<{ id: number; tableNo: string; qrUrl?: string; error?: string }>>(
      "/admin/tables/miniprogram-codes",
      { method: "POST", body: JSON.stringify({ ids }) },
    ),
};
