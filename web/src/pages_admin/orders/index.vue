<template>
  <view class="page">
    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="tab"
        :class="activeTab === t.value ? 'tab-active' : ''"
        @tap="switchTab(t.value)"
      >
        {{ t.label }}
      </view>
    </scroll-view>

    <view v-if="activeTab !== 'REFUNDS'">
      <view v-for="o in orders" :key="o.id" class="card order">
        <view class="o-top">
          <text class="badge" :class="statusClass(o.status)">{{ statusText(o.status) }}</text>
          <text class="o-no">{{ o.orderNo }}</text>
        </view>
        <view class="o-items">
          <view class="o-item" v-for="i in o.items" :key="i.id">
            {{ i.productName }} ×{{ i.quantity }}
            <text class="o-specs">{{ specsText(i.specsDetail) }}</text>
          </view>
        </view>
        <view class="o-meta">
          <text class="text-sub">
            {{ o.orderType === "DINE_IN" ? o.table?.tableNo || "堂食" : "外带" }}
            · {{ o.pickupNo }} · {{ timeText(o.createdAt) }}
          </text>
          <text class="price">¥{{ o.totalAmount }}</text>
        </view>
        <view v-if="o.remark" class="o-remark">备注：{{ o.remark }}</view>
        <view class="actions">
          <view v-if="o.status === 'PAID'" class="act-btn" @tap="setStatus(o, 'MAKING')">接单</view>
          <view v-if="o.status === 'MAKING'" class="act-btn" @tap="setStatus(o, 'READY')">出餐</view>
          <view v-if="o.status === 'READY'" class="act-btn" @tap="setStatus(o, 'COMPLETED')">完成</view>
        </view>
      </view>
      <view v-if="!orders.length" class="empty">暂无订单</view>
    </view>

    <view v-else>
      <view v-for="r in refunds" :key="r.id" class="card order">
        <view class="o-top">
          <text class="badge badge-warning">退款申请</text>
          <text class="o-no">#{{ r.id }} · {{ timeText(r.createdAt) }}</text>
        </view>
        <view class="o-items">
          <view class="o-item" v-for="i in r.order.items" :key="i.id">
            {{ i.productName }} ×{{ i.quantity }}
          </view>
        </view>
        <view class="o-remark">原因：{{ r.reason }}</view>
        <view class="o-remark">金额：¥{{ r.order.totalAmount }}</view>
        <view class="actions">
          <view class="act-btn" @tap="handleRefund(r, 'approved')">同意退款</view>
          <view class="act-btn danger" @tap="handleRefund(r, 'rejected')">拒绝</view>
        </view>
      </view>
      <view v-if="!refunds.length" class="empty">暂无退款申请</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onUnload } from "@dcloudio/uni-app";
import { ref } from "vue";
import { api } from "../../api";
import { ORDER_STATUS_TEXT, type Order, type OrderStatus } from "../../types";

const tabs = [
  { label: "待接单", value: "PAID" },
  { label: "制作中", value: "MAKING" },
  { label: "待取餐", value: "READY" },
  { label: "已完成", value: "COMPLETED" },
  { label: "退款", value: "REFUNDS" },
];
const activeTab = ref("PAID");
const orders = ref<Order[]>([]);
const refunds = ref<any[]>([]);
let timer: any = null;

async function load() {
  try {
    if (activeTab.value === "REFUNDS") {
      refunds.value = await api.adminRefunds();
    } else {
      const data = await api.adminOrders(activeTab.value);
      orders.value = data.list;
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function switchTab(v: string) {
  activeTab.value = v;
  load();
}

load();
timer = setInterval(load, 10000);
onUnload(() => {
  if (timer) clearInterval(timer);
});

async function setStatus(o: Order, status: string) {
  try {
    await api.adminUpdateOrderStatus(o.id, status);
    uni.showToast({ title: "已更新", icon: "success" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function handleRefund(r: any, action: "approved" | "rejected") {
  let rejectReason = "";
  if (action === "rejected") {
    const res = await new Promise<string>((resolve) => {
      uni.showModal({
        title: "拒绝退款",
        editable: true,
        placeholderText: "请输入拒绝原因",
        success: (m) => resolve(m.confirm ? m.content || "其他原因" : ""),
      });
    });
    if (!res) return;
    rejectReason = res;
  }
  try {
    await api.adminHandleRefund(r.id, action, rejectReason);
    uni.showToast({ title: action === "approved" ? "已同意退款" : "已拒绝", icon: "success" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

function statusText(status: OrderStatus) {
  return ORDER_STATUS_TEXT[status] || status;
}

function statusClass(status: OrderStatus) {
  const map: Record<string, string> = {
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

function specsText(specs: Record<string, string | string[]>) {
  return Object.values(specs || {}).flat().join(" / ");
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
}

.o-item {
  font-size: 28rpx;
  color: #4a3d31;
  margin-bottom: 4rpx;
}

.o-specs {
  color: #6b625b;
  font-size: 22rpx;
  margin-left: 8rpx;
}

.o-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.o-remark {
  color: #8a7158;
  font-size: 24rpx;
  margin-top: 8rpx;
}

.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  justify-content: flex-end;
}

.act-btn {
  background: #2f2a26;
  color: #fff;
  border-radius: 24px;
  padding: 12rpx 36rpx;
  font-size: 26rpx;
}

.danger {
  background: #b04a3a;
}
</style>
