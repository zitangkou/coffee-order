<template>
  <view class="page">
    <view class="card add-row">
      <input v-model="newTable" class="f-input" placeholder="桌号，如 A09" />
      <view class="mini-btn" @tap="addTable">新增</view>
    </view>

    <view class="card takeout-row">
      <view>
        <view class="takeout-title">外带小程序码</view>
        <view class="text-sub">吧台专用，扫码直接进入外带模式</view>
      </view>
      <view class="mini-btn" @tap="genTakeout">{{ takeoutQr ? "重新生成" : "生成" }}</view>
      <view v-if="takeoutQr" class="mini-btn" @tap="showImage(takeoutQr)">查看</view>
    </view>

    <view class="card" v-for="t in tables" :key="t.id">
      <view class="t-row">
        <view class="t-no">
          {{ t.tableNo }}
          <text class="badge" :class="t.isActive ? 'badge-success' : 'badge-grey'">
            {{ t.isActive ? "启用" : "停用" }}
          </text>
        </view>
        <view class="t-actions">
          <view class="mini-btn" @tap="toggle(t)">{{ t.isActive ? "停用" : "启用" }}</view>
          <view class="mini-btn" @tap="qr(t)">生成小程序码</view>
          <view v-if="t.qrCodeUrl" class="mini-btn" @tap="openQr(t)">查看</view>
          <view class="mini-btn danger" @tap="remove(t)">删除</view>
        </view>
      </view>
      <view v-if="t.qrCodeUrl" class="text-sub qr-hint">二维码：{{ t.qrCodeUrl }}</view>
    </view>

    <view v-if="!tables.length" class="empty">暂无桌台，先新增一个吧</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { API_BASE } from "../../config";
import type { Table } from "../../types";

const tables = ref<Table[]>([]);
const newTable = ref("");
const takeoutQr = ref("");

onShow(load);

async function load() {
  try {
    tables.value = await api.adminTables();
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

async function addTable() {
  if (!newTable.value.trim()) return;
  try {
    await api.adminCreateTable(newTable.value.trim());
    newTable.value = "";
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "新增失败", icon: "none" });
  }
}

async function toggle(t: Table) {
  try {
    await api.adminUpdateTable(t.id, { isActive: !t.isActive });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function qr(t: Table) {
  try {
    uni.showLoading({ title: "生成中" });
    const data = await api.adminTableMiniProgramCode(t.id);
    uni.hideLoading();
    uni.showToast({ title: "小程序码已生成", icon: "success" });
    load();
    setTimeout(() => openQr({ ...t, qrCodeUrl: data.qrUrl }), 600);
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "生成失败", icon: "none" });
  }
}

function openQr(t: Table) {
  showImage(t.qrCodeUrl || "");
}

function showImage(path: string) {
  const full = API_BASE.replace(/\/api$/, "") + path;
  // #ifdef H5
  window.open(full, "_blank");
  // #endif
  // #ifndef H5
  uni.previewImage({ urls: [full] });
  // #endif
}

async function genTakeout() {
  try {
    uni.showLoading({ title: "生成中" });
    const data = await api.adminTakeoutMiniProgramCode();
    uni.hideLoading();
    takeoutQr.value = data.qrUrl;
    uni.showToast({ title: "外带小程序码已生成", icon: "success" });
    setTimeout(() => showImage(data.qrUrl), 600);
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "生成失败", icon: "none" });
  }
}

async function remove(t: Table) {
  const res = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: "删除桌台",
      content: `确认删除「${t.tableNo}」？`,
      success: (m) => resolve(!!m.confirm),
    });
  });
  if (!res) return;
  try {
    await api.adminDeleteTable(t.id);
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "删除失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.add-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.takeout-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.takeout-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 4rpx;
}

.f-input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  flex: 1;
}

.mini-btn {
  border: 1px solid #2f2a26;
  color: #2f2a26;
  border-radius: 24px;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
}

.danger {
  border-color: #b04a3a;
  color: #b04a3a;
}

.t-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.t-no {
  font-size: 32rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.t-actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.qr-hint {
  margin-top: 12rpx;
  word-break: break-all;
}
</style>
