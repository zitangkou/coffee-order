<template>
  <el-config-provider :locale="zhCn"><router-view /></el-config-provider>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { useAuthStore } from "./stores/auth";
import router from "./router";

const auth = useAuthStore();
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = "admin_last_activity";
const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
let lastRecorded = 0;
let idleTimer: number | undefined;
function recordActivity() {
  if (!auth.isAuthenticated || Date.now() - lastRecorded < 15_000) return;
  lastRecorded = Date.now();
  localStorage.setItem(ACTIVITY_KEY, String(lastRecorded));
}
function checkIdle() {
  if (!auth.isAuthenticated) return;
  const last = Number(localStorage.getItem(ACTIVITY_KEY) || Date.now());
  if (Date.now() - last < IDLE_LIMIT_MS) return;
  auth.clear();
  localStorage.removeItem(ACTIVITY_KEY);
  ElMessage.warning("会话已因长时间无操作而退出");
  router.replace({ path: "/login", query: { reason: "idle" } });
}
function syncSession(event: StorageEvent) {
  if (event.key !== "admin_token" || event.newValue) return;
  auth.clear();
  if (router.currentRoute.value.path !== "/login") router.replace("/login");
}
onMounted(() => {
  if (auth.isAuthenticated && !localStorage.getItem(ACTIVITY_KEY)) recordActivity();
  for (const event of events) window.addEventListener(event, recordActivity, { passive: true });
  window.addEventListener("storage", syncSession);
  idleTimer = window.setInterval(checkIdle, 30_000);
});
onBeforeUnmount(() => {
  for (const event of events) window.removeEventListener(event, recordActivity);
  window.removeEventListener("storage", syncSession);
  window.clearInterval(idleTimer);
});
</script>
