import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const AdminLayout = () => import("../layouts/AdminLayout.vue");
const LoginView = () => import("../views/LoginView.vue");
const DashboardView = () => import("../views/DashboardView.vue");
const OrdersView = () => import("../views/OrdersView.vue");
const ProductsView = () => import("../views/ProductsView.vue");
const TablesView = () => import("../views/TablesView.vue");
const AdminsView = () => import("../views/AdminsView.vue");
const SettingsView = () => import("../views/SettingsView.vue");
const MembersView = () => import("../views/MembersView.vue");
const AnalyticsView = () => import("../views/AnalyticsView.vue");
const MarketingView = () => import("../views/MarketingView.vue");
const ChangePasswordView = () => import("../views/ChangePasswordView.vue");

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
          component: ProductsView,
          meta: { title: "商品中心" },
        },
        {
          path: "tables",
          component: TablesView,
          meta: { title: "桌台与取餐码" },
        },
        {
          path: "members",
          component: MembersView,
          meta: { title: "会员管理" },
        },
        {
          path: "analytics",
          component: AnalyticsView,
          meta: { title: "数据分析" },
        },
        {
          path: "marketing",
          component: MarketingView,
          meta: { title: "营销运营", managerOnly: true },
        },
        {
          path: "settings",
          component: SettingsView,
          meta: { title: "门店设置", managerOnly: true },
        },
        {
          path: "admins",
          component: AdminsView,
          meta: { title: "员工与权限", managerOnly: true },
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
