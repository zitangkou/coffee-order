import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const AdminLayout = () => import("../layouts/AdminLayout.vue");
const LoginView = () => import("../views/LoginView.vue");
const DashboardView = () => import("../views/DashboardView.vue");
const OrdersView = () => import("../views/OrdersView.vue");
const ChangePasswordView = () => import("../views/ChangePasswordView.vue");
const PlaceholderView = () => import("../views/PlaceholderView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: LoginView,
      meta: { public: true, title: "登录" },
    },
    {
      path: "/change-password",
      component: ChangePasswordView,
      meta: { title: "修改密码", allowPasswordChange: true },
    },
    {
      path: "/",
      component: AdminLayout,
      redirect: "/dashboard",
      children: [
        {
          path: "dashboard",
          component: DashboardView,
          meta: { title: "经营看板" },
        },
        { path: "orders", component: OrdersView, meta: { title: "订单中心" } },
        {
          path: "products",
          component: PlaceholderView,
          meta: { title: "商品中心", module: "products" },
        },
        {
          path: "tables",
          component: PlaceholderView,
          meta: { title: "桌台与取餐码", module: "tables" },
        },
        {
          path: "members",
          component: PlaceholderView,
          meta: { title: "会员管理", module: "members" },
        },
        {
          path: "analytics",
          component: PlaceholderView,
          meta: { title: "数据分析", module: "analytics" },
        },
        {
          path: "settings",
          component: PlaceholderView,
          meta: { title: "门店设置", managerOnly: true, module: "settings" },
        },
        {
          path: "admins",
          component: PlaceholderView,
          meta: { title: "员工与权限", managerOnly: true, module: "admins" },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) return auth.isAuthenticated ? "/dashboard" : true;
  if (!auth.isAuthenticated)
    return { path: "/login", query: { redirect: to.fullPath } };
  if (auth.admin?.mustChangePassword && !to.meta.allowPasswordChange)
    return "/change-password";
  if (to.meta.managerOnly && !auth.isManager) return "/dashboard";
  return true;
});

window.addEventListener("admin:unauthorized", () => {
  const auth = useAuthStore();
  auth.clear();
  if (router.currentRoute.value.path !== "/login") router.replace("/login");
});
window.addEventListener("admin:password-required", () =>
  router.replace("/change-password"),
);

export default router;
