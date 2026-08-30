<template>
  <view class="page">
    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="tab"
        :class="activeTab === t.value ? 'tab-active' : ''"
        @tap="activeTab = t.value"
      >
        {{ t.label }}
      </view>
    </scroll-view>

    <view v-if="loading" class="empty">订单加载中…</view>
    <view v-else-if="error" class="card empty">{{ error }}</view>
    <view v-else v-for="o in filtered" :key="o.id" class="card order" @tap="goDetail(o.id)">
      <view class="o-top">
        <text class="o-no">{{ o.orderNo }}</text>
        <text class="badge" :class="statusClass(o.status)">{{ statusText(o.status) }}</text>
      </view>
      <view class="o-items">
        <view class="o-item" v-for="i in o.items.slice(0, 3)" :key="i.id">
          {{ i.productName }} ×{{ i.quantity }}
        </view>
      </view>
      <view class="o-bottom">
        <text class="text-sub">{{ o.orderType === "DINE_IN" ? o.table?.tableNo || "堂食" : "外带" }} · {{ timeText(o.createdAt) }}</text>
        <text class="price">¥{{ o.totalAmount }}</text>
      </view>
    </view>

    <view v-if="!loading && !error && !filtered.length" class="empty">暂无订单</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app";
import { api } from "../../api";
import { ORDER_STATUS_TEXT, type Order, type OrderStatus } from "../../types";
import { useUserStore } from "../../stores/user";
import { blockDisabledH5Customer } from "../../utils/customerAccess";

const user = useUserStore();
const orders = ref<Order[]>([]);
const loading = ref(true);
const error = ref("");
const activeTab = ref("");
const tabs = [
  { label: "全部", value: "" },
  { label: "待接单", value: "PAID" },
  { label: "制作中", value: "MAKING" },
  { label: "待取餐", value: "READY" },
  { label: "已完成", value: "COMPLETED" },
];

const filtered = computed(() =>
  activeTab.value ? orders.value.filter((o) => o.status === activeTab.value) : orders.value
);

onLoad(async () => {
  if (blockDisabledH5Customer()) return;
  try {
    await user.ensureLogin();
  } catch (e: any) {
    error.value = e.message || "微信登录失败，请重新进入小程序";
    loading.value = false;
    return;
  }
  if (!user.token) {
    error.value = "当前仅支持在微信小程序登录后查看订单";
    loading.value = false;
    return;
  }
  await load();
});
onPullDownRefresh(async () => {
  await load();
  uni.stopPullDownRefresh();
});

async function load() {
  if (!user.token) return;
  loading.value = true;
  error.value = "";
  try {
    orders.value = await api.myOrders();
  } catch (e: any) {
    error.value = e.message || "订单加载失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` });
}

function statusText(status: OrderStatus) {
  return ORDER_STATUS_TEXT[status] || status;
}

function statusClass(status: OrderStatus) {
  const map: Record<string, string> = {
    UNPAID: "badge-warning",
    PAID: "badge-primary",
    MAKING: "badge-accent",
    READY: "badge-success",
    COMPLETED: "badge-grey",
    REFUNDING: "badge-warning",
    REFUNDED: "badge-danger",
    CANCELLED: "badge-grey",
  };
  return map[status] || "badge-grey";
}

function timeText(t: string) {
  return (t || "").replace("T", " ").slice(5, 16);
}
</script>

<style lang="scss" scoped>
.tabs {
  white-space: nowrap;
  margin-bottom: 16rpx;
}

.tab {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  background: #fff;
  border-radius: 24px;
  color: #6b625b;
  font-size: 26rpx;
}

.tab-active {
  background: #2f2a26;
  color: #fff;
}

.o-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.o-no {
  color: #6b625b;
  font-size: 22rpx;
}

.o-items {
  margin: 16rpx 0;
  color: #4a3d31;
  font-size: 28rpx;
}

.o-item {
  margin-bottom: 4rpx;
}

.o-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8rpx;
}
</style>
