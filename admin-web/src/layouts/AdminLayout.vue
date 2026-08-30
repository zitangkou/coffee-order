<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand">
        <div class="brand-mark">C</div>
        <div v-if="!collapsed">
          <strong>Coffee OS</strong><span>门店管理中心</span>
        </div>
      </div>
      <el-menu
        :default-active="route.path"
        router
        class="side-menu"
        :collapse="collapsed"
      >
        <el-menu-item
          v-for="item in visibleMenu"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon
          ><template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>
      <button class="collapse-button" @click="collapsed = !collapsed">
        {{ collapsed ? "展开" : "收起导航" }}
      </button>
    </aside>

    <section class="main-shell">
      <header class="topbar">
        <div>
          <div class="page-title">{{ route.meta.title }}</div>
          <div class="breadcrumb">Coffee OS / {{ route.meta.title }}</div>
        </div>
        <div class="top-actions">
          <el-tag effect="plain" round>{{
            auth.isManager ? "店长" : "店员"
          }}</el-tag>
          <el-dropdown trigger="click">
            <button class="account-button">
              <span class="avatar">{{
                auth.admin?.username?.slice(0, 1).toUpperCase()
              }}</span
              >{{ auth.admin?.username }}
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="router.push('/change-password')"
                  >修改密码</el-dropdown-item
                >
                <el-dropdown-item divided @click="logout"
                  >退出登录</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="page-content"><router-view /></main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  DataAnalysis,
  Goods,
  HomeFilled,
  List,
  Operation,
  Setting,
  UserFilled,
  Wallet,
} from "@element-plus/icons-vue";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const collapsed = ref(false);
const menu = [
  { path: "/dashboard", label: "经营看板", icon: HomeFilled },
  { path: "/orders", label: "订单中心", icon: List },
  { path: "/products", label: "商品中心", icon: Goods },
  { path: "/tables", label: "桌台与取餐码", icon: Operation },
  { path: "/members", label: "会员管理", icon: UserFilled },
  { path: "/analytics", label: "数据分析", icon: DataAnalysis },
  { path: "/settings", label: "门店设置", icon: Setting, managerOnly: true },
  { path: "/admins", label: "员工与权限", icon: Wallet, managerOnly: true },
];
const visibleMenu = computed(() =>
  menu.filter((item) => !item.managerOnly || auth.isManager),
);
function logout() {
  auth.clear();
  router.replace("/login");
}
</script>
