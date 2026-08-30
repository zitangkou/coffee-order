import { STORAGE_KEYS } from "../config";

export interface AdminSessionInfo {
  id?: number;
  username?: string;
  role?: "STAFF" | "MANAGER";
  mustChangePassword?: boolean;
}

let redirecting = false;

export function getAdminInfo(): AdminSessionInfo {
  return (uni.getStorageSync(STORAGE_KEYS.adminInfo) as AdminSessionInfo) || {};
}

export function clearAdminSession() {
  uni.removeStorageSync(STORAGE_KEYS.adminToken);
  uni.removeStorageSync(STORAGE_KEYS.adminInfo);
}

function redirect(url: string) {
  if (redirecting) return;
  redirecting = true;
  uni.reLaunch({
    url,
    complete: () => setTimeout(() => (redirecting = false), 300),
  });
}

export function redirectAdminLogin(message = "请先登录") {
  clearAdminSession();
  uni.showToast({ title: message, icon: "none" });
  redirect("/pages_admin/login/index");
}

export function redirectChangePassword(message = "请先修改密码") {
  uni.showToast({ title: message, icon: "none" });
  redirect("/pages_admin/change-password/index?first=1");
}

export function requireAdminPage(managerOnly = false): AdminSessionInfo | null {
  const token = uni.getStorageSync(STORAGE_KEYS.adminToken);
  const info = getAdminInfo();
  if (!token) {
    redirectAdminLogin();
    return null;
  }
  if (info.mustChangePassword) {
    redirectChangePassword();
    return null;
  }
  if (managerOnly && info.role !== "MANAGER") {
    uni.showToast({ title: "仅店长可访问", icon: "none" });
    redirect("/pages_admin/dashboard/index");
    return null;
  }
  return info;
}

export function requireAdminToken(): boolean {
  if (uni.getStorageSync(STORAGE_KEYS.adminToken)) return true;
  redirectAdminLogin();
  return false;
}
