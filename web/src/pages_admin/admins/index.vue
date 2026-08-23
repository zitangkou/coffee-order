<template>
  <view class="page">
    <view class="card">
      <view class="sheet-title">新增管理员</view>
      <view class="f-label">用户名</view>
      <input v-model="newUsername" class="f-input" placeholder="登录名" />
      <view class="f-label">初始密码（至少 8 位）</view>
      <input v-model="newPassword" class="f-input" password placeholder="初始密码" />
      <view class="f-label">角色</view>
      <picker :range="['店员 STAFF', '店长 MANAGER']" @change="onRoleChange">
        <view class="f-input">{{ newRole === "MANAGER" ? "店长 MANAGER" : "店员 STAFF" }}</view>
      </picker>
      <view class="btn-primary create-btn" @tap="create">创建管理员</view>
    </view>

    <view class="card" v-for="a in admins" :key="a.id">
      <view class="a-row">
        <view class="a-info">
          <view class="a-name">
            {{ a.username }}
            <text class="badge" :class="a.role === 'MANAGER' ? 'badge-primary' : 'badge-grey'">
              {{ a.role === "MANAGER" ? "店长" : "店员" }}
            </text>
            <text class="badge" :class="a.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'">
              {{ a.status === "ACTIVE" ? "启用" : "禁用" }}
            </text>
          </view>
          <view class="text-sub">创建于 {{ (a.createdAt || "").replace("T", " ").slice(0, 16) }}</view>
        </view>
        <view class="a-actions">
          <view class="mini-btn" @tap="toggleStatus(a)">{{ a.status === "ACTIVE" ? "禁用" : "启用" }}</view>
          <view class="mini-btn" @tap="toggleRole(a)">{{ a.role === "MANAGER" ? "设为店员" : "设为店长" }}</view>
          <view class="mini-btn" @tap="resetPassword(a)">重置密码</view>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="sheet-title">操作审计（最近 50 条）</view>
      <view v-for="log in logs" :key="log.id" class="log-row">
        <text class="log-action">{{ log.action }}</text>
        <text class="log-meta">{{ log.admin?.username || "系统" }} · {{ (log.createdAt || "").replace("T", " ").slice(5, 16) }}</text>
      </view>
      <view v-if="!logs.length" class="empty">暂无审计记录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { STORAGE_KEYS } from "../../config";

const admins = ref<any[]>([]);
const logs = ref<any[]>([]);
const newUsername = ref("");
const newPassword = ref("");
const newRole = ref<"STAFF" | "MANAGER">("STAFF");

function onRoleChange(e: any) {
  newRole.value = Number(e.detail.value) === 1 ? "MANAGER" : "STAFF";
}

onShow(load);

async function load() {
  try {
    const [as, ls] = await Promise.all([api.adminAdmins(), api.adminAuditLogs()]);
    admins.value = as;
    logs.value = ls;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

async function create() {
  if (!newUsername.value.trim() || newPassword.value.length < 8) {
    uni.showToast({ title: "用户名必填，密码至少 8 位", icon: "none" });
    return;
  }
  try {
    await api.adminCreateAdmin(newUsername.value.trim(), newPassword.value, newRole.value);
    newUsername.value = "";
    newPassword.value = "";
    uni.showToast({ title: "已创建", icon: "success" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "创建失败", icon: "none" });
  }
}

function isSelf(a: any) {
  const info = uni.getStorageSync(STORAGE_KEYS.adminInfo) as any;
  return info?.username === a.username;
}

async function toggleStatus(a: any) {
  if (isSelf(a)) {
    uni.showToast({ title: "不能禁用自己", icon: "none" });
    return;
  }
  try {
    await api.adminUpdateAdmin(a.id, { status: a.status === "ACTIVE" ? "DISABLED" : "ACTIVE" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function toggleRole(a: any) {
  if (isSelf(a)) {
    uni.showToast({ title: "不能修改自己的角色", icon: "none" });
    return;
  }
  try {
    await api.adminUpdateAdmin(a.id, { role: a.role === "MANAGER" ? "STAFF" : "MANAGER" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function resetPassword(a: any) {
  const res = await new Promise<string>((resolve) => {
    uni.showModal({
      title: `重置 ${a.username} 的密码`,
      editable: true,
      placeholderText: "输入新密码（至少 8 位）",
      success: (m) => resolve(m.confirm ? m.content || "" : ""),
    });
  });
  if (!res || res.length < 8) {
    uni.showToast({ title: "密码至少 8 位", icon: "none" });
    return;
  }
  try {
    await api.adminUpdateAdmin(a.id, { password: res });
    uni.showToast({ title: "密码已重置", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.sheet-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.f-label {
  font-size: 24rpx;
  color: #6b625b;
  margin: 16rpx 0 8rpx;
}

.f-input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.create-btn {
  margin-top: 24rpx;
}

.a-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
}

.a-name {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 30rpx;
  font-weight: 600;
  flex-wrap: wrap;
}

.a-actions {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.mini-btn {
  border: 1px solid #2f2a26;
  color: #2f2a26;
  border-radius: 24px;
  padding: 6rpx 18rpx;
  font-size: 22rpx;
}

.log-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1px solid #f4f0ea;
  font-size: 24rpx;
}

.log-action {
  color: #2f2a26;
  font-weight: 600;
}

.log-meta {
  color: #b9b0a6;
}
</style>
