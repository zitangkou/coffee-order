import request from "../utils/request";
import type { Category, Order, Product, Shop, Table } from "../types";

export const api = {
  // 顾客端
  getCategories: () => request<Category[]>({ url: "/categories" }),
  getProduct: (id: number) => request<Product>({ url: `/products/${id}` }),
  getTables: () => request<Table[]>({ url: "/tables" }),
  getShop: () => request<Shop>({ url: "/shop" }),
  guestLogin: (deviceId: string) =>
    request<{ userId: number; token: string }>({
      url: "/auth/guest",
      method: "POST",
      data: { deviceId },
    }),
  createOrder: (data: {
    tableId?: number;
    orderType: "DINE_IN" | "TAKEOUT";
    items: { productId: number; quantity: number; specs: Record<string, string | string[]> }[];
    remark?: string;
    phone?: string;
  }) => request<Order>({ url: "/orders", method: "POST", data }),
  mockPay: (id: number) => request<Order>({ url: `/orders/${id}/mock-pay`, method: "POST" }),
  myOrders: () => request<Order[]>({ url: "/orders/my" }),
  getOrder: (id: number) => request<Order>({ url: `/orders/${id}` }),
  requestRefund: (id: number, reason: string) =>
    request<Order>({ url: `/orders/${id}/refund`, method: "POST", data: { reason } }),

  // 商家端
  adminLogin: (username: string, password: string) =>
    request<{ token: string; admin: { id: number; username: string; role: string } }>({
      url: "/admin/login",
      method: "POST",
      data: { username, password },
    }),
  adminStatsToday: () => request<any>({ url: "/admin/stats/today", admin: true }),
  adminStatsSummary: (range: string) =>
    request<any>({ url: `/admin/stats/summary?range=${range}`, admin: true }),
  adminStatsProducts: (range: string) =>
    request<any[]>({ url: `/admin/stats/products?range=${range}`, admin: true }),
  adminStatsHours: () => request<any[]>({ url: "/admin/stats/hours", admin: true }),
  adminOrders: (status = "", page = 1) =>
    request<{ list: Order[]; total: number }>({
      url: `/admin/orders?status=${status}&page=${page}`,
      admin: true,
    }),
  adminUpdateOrderStatus: (id: number, status: string) =>
    request<Order>({ url: `/admin/orders/${id}/status`, method: "PATCH", data: { status }, admin: true }),
  adminRefunds: () =>
    request<any[]>({ url: "/admin/refunds", admin: true }),
  adminHandleRefund: (id: number, action: "approved" | "rejected", rejectReason = "") =>
    request<any>({
      url: `/admin/refunds/${id}`,
      method: "PUT",
      data: { action, rejectReason },
      admin: true,
    }),
  adminCategories: () => request<any[]>({ url: "/admin/categories", admin: true }),
  adminCreateCategory: (name: string) =>
    request<any>({ url: "/admin/categories", method: "POST", data: { name }, admin: true }),
  adminDeleteCategory: (id: number) =>
    request<any>({ url: `/admin/categories/${id}`, method: "DELETE", admin: true }),
  adminProducts: (params: { keyword?: string; categoryId?: number; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.keyword) qs.set("keyword", params.keyword);
    if (params.categoryId) qs.set("categoryId", String(params.categoryId));
    if (params.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<Product[]>({ url: `/admin/products${q ? `?${q}` : ""}`, admin: true });
  },
  adminCreateProduct: (data: Partial<Product> & { categoryId: number }) =>
    request<Product>({ url: "/admin/products", method: "POST", data, admin: true }),
  adminUpdateProduct: (id: number, data: Partial<Product>) =>
    request<Product>({ url: `/admin/products/${id}`, method: "PUT", data, admin: true }),
  adminSpecGroups: () =>
    request<any[]>({ url: "/admin/spec-groups", admin: true }),
  adminCreateSpecGroup: (data: {
    name: string;
    type: "SINGLE" | "MULTI";
    options: { label: string; extraPrice: number; isDefault: boolean }[];
  }) => request<any>({ url: "/admin/spec-groups", method: "POST", data, admin: true }),
  adminToggleSoldOut: (id: number, soldOut: boolean) =>
    request<Product>({ url: `/admin/products/${id}/sold-out`, method: "PATCH", data: { soldOut }, admin: true }),
  adminTables: () => request<Table[]>({ url: "/admin/tables", admin: true }),
  adminCreateTable: (tableNo: string) =>
    request<Table>({ url: "/admin/tables", method: "POST", data: { tableNo }, admin: true }),
  adminUpdateTable: (id: number, data: Partial<Table>) =>
    request<Table>({ url: `/admin/tables/${id}`, method: "PUT", data, admin: true }),
  adminDeleteTable: (id: number) =>
    request<any>({ url: `/admin/tables/${id}`, method: "DELETE", admin: true }),
  adminTableQrcode: (id: number) =>
    request<{ qrUrl: string; url: string; tableNo: string }>({
      url: `/admin/tables/${id}/qrcode`,
      method: "POST",
      admin: true,
    }),
  adminSettings: () => request<any>({ url: "/admin/settings", admin: true }),
  adminSaveSettings: (data: Record<string, unknown>) =>
    request<any>({ url: "/admin/settings", method: "PUT", data, admin: true }),
  adminPrinterTest: () => request<any>({ url: "/admin/printer/test", method: "POST", admin: true }),
  adminChangePassword: (oldPassword: string, newPassword: string) =>
    request<any>({
      url: "/admin/password",
      method: "PUT",
      data: { oldPassword, newPassword },
      admin: true,
    }),
  adminTakeoutQrcode: () =>
    request<{ qrUrl: string; url: string }>({
      url: "/admin/takeout-qrcode",
      method: "POST",
      admin: true,
    }),
};
