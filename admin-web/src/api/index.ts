import { http } from "./http";
import type {
  AdminInfo,
  Order,
  ProductRank,
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
  today: () => http<TodayStats>("/admin/stats/today"),
  trend: (days = 7) => http<TrendPoint[]>(`/admin/stats/trend?days=${days}`),
  productsRank: (range = "today") =>
    http<ProductRank[]>(`/admin/stats/products?range=${range}`),
  refundStats: (range = "today") =>
    http<{ count: number; amount: number }>(
      `/admin/stats/refunds?range=${range}`,
    ),
  orders: (status = "", page = 1, pageSize = 20) =>
    http<{ list: Order[]; total: number; page: number; pageSize: number }>(
      `/admin/orders?status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}`,
    ),
  updateOrderStatus: (id: number, status: string) =>
    http<Order>(`/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
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
};
