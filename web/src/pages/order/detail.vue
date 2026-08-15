<template>
  <view class="page">
    <view v-if="order" class="card status-card">
      <view class="pickup-code">{{ order.pickupNo }}</view>
      <view class="pickup-label">取餐码</view>
      <StepBar v-if="isNormalStatus" :status="order.status" />
      <view v-else class="refund-card">
        <text class="badge" :class="statusClass(order.status)">{{ statusText(order.status) }}</text>
      </view>
      <view class="status-line">{{ statusHint }}</view>
    </view>

    <view v-if="order" class="card">
      <view class="o-row"><text class="label">订单号</text><text>{{ order.orderNo }}</text></view>
      <view class="o-row">
        <text class="label">用餐方式</text>
        <text>{{ order.orderType === "DINE_IN" ? `堂食 · ${order.table?.tableNo || ""}` : "外带" }}</text>
      </view>
      <view class="o-row"><text class="label">下单时间</text><text>{{ order.createdAt.replace("T", " ").slice(0, 19) }}</text></view>
      <view v-if="order.remark" class="o-row"><text class="label">备注</text><text>{{ order.remark }}</text></view>
    </view>

    <view v-if="order" class="card">
      <view class="o-item" v-for="i in order.items" :key="i.id">
        <view class="o-info">
          <view class="o-name">{{ i.productName }} ×{{ i.quantity }}</view>
          <view class="o-specs">{{ specsText(i.specsDetail) }}</view>
        </view>
        <text class="price">¥{{ i.subtotal }}</text>
      </view>
      <view class="divider" />
      <view class="o-row"><text class="label">合计</text><text class="price">¥{{ order.totalAmount }}</text></view>
    </view>

    <view v-if="order && canRefund" class="btn-outline refund-btn" @tap="showRefund = true">
      申请退款
    </view>

    <view v-if="order?.refunds?.length" class="card">
      <view class="spec-name">退款记录</view>
      <view class="o-row" v-for="r in order.refunds" :key="r.id">
        <text class="label">{{ r.status === "PENDING" ? "审核中" : r.status === "APPROVED" ? "已同意" : "已拒绝" }}</text>
        <text class="text-sub">{{ r.reason }}</text>
      </view>
    </view>

    <view v-if="showRefund" class="mask" @tap="showRefund = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">申请退款</view>
        <view class="reason-list">
          <view
            v-for="r in reasons"
            :key="r"
            class="reason"
            :class="refundReason === r ? 'reason-active' : ''"
            @tap="refundReason = r"
          >
            {{ r }}
          </view>
        </view>
        <view class="btn-primary" @tap="submitRefund">提交申请</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { api } from "../../api";
import { ORDER_STATUS_TEXT, type Order, type OrderStatus } from "../../types";
import StepBar from "../../components/StepBar.vue";

const order = ref<Order | null>(null);
const showRefund = ref(false);
const refundReason = ref("");
const reasons = ["不想要了", "点错了", "等待太久", "品质问题", "其他"];
let timer: any = null;
let prevStatus = "";

const normalStatuses = ["PAID", "MAKING", "READY", "COMPLETED"];

const isNormalStatus = computed(() => {
  return normalStatuses.includes(order.value?.status || "");
});

const statusHint = computed(() => {
  const map: Record<string, string> = {
    UNPAID: "订单待支付",
    PAID: "已支付，等待咖啡师接单",
    MAKING: "正在制作，预计 10 分钟",
    READY: "咖啡已好，请到吧台取餐",
    COMPLETED: "订单已完成，感谢光临",
    REFUNDING: "退款申请审核中，请稍候",
    REFUNDED: "订单已退款",
    CANCELLED: "订单已取消",
  };
  return map[order.value?.status || ""] || "";
});

const canRefund = computed(() => {
  const s = order.value?.status;
  return ["PAID", "MAKING", "READY", "COMPLETED"].includes(s || "");
});

onLoad(async (options) => {
  const id = Number((options as any)?.id);
  try {
    order.value = await api.getOrder(id);
    prevStatus = order.value.status;
    startPolling(id);
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

onUnload(() => {
  if (timer) clearInterval(timer);
});

function startPolling(id: number) {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    try {
      const latest = await api.getOrder(id);
      const changed = latest.status !== prevStatus;
      prevStatus = latest.status;
      order.value = latest;
      if (changed && latest.status === "READY") {
        uni.showToast({ title: "咖啡已好，请取餐", icon: "none" });
      }
      if (["COMPLETED", "REFUNDED", "CANCELLED"].includes(latest.status)) {
        clearInterval(timer);
      }
    } catch {
      // 轮询失败静默，下次再试
    }
  }, 10000);
}

function specsText(specs: Record<string, string | string[]>) {
  return Object.values(specs || {}).flat().join(" / ") || "标准";
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

async function submitRefund() {
  if (!refundReason.value) {
    uni.showToast({ title: "请选择退款原因", icon: "none" });
    return;
  }
  try {
    order.value = await api.requestRefund(order.value!.id, refundReason.value);
    showRefund.value = false;
    uni.showToast({ title: "退款申请已提交", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "申请失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.status-card {
  text-align: center;
  padding: 48rpx 24rpx;
}

.pickup-code {
  font-size: 88rpx;
  font-weight: 800;
  letter-spacing: 6rpx;
  color: #2f2a26;
}

.pickup-label {
  color: #6b625b;
  font-size: 24rpx;
  margin-bottom: 32rpx;
}

.status-line {
  margin-top: 20rpx;
  font-size: 26rpx;
  color: #6b625b;
}

.refund-card {
  display: flex;
  justify-content: center;
  margin-top: 32rpx;
}

.o-row {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
  font-size: 26rpx;
}

.label {
  color: #6b625b;
}

.o-item {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.o-name {
  font-size: 28rpx;
}

.o-specs {
  color: #6b625b;
  font-size: 22rpx;
}

.refund-btn {
  margin: 24rpx 0;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}

.sheet {
  background: #fff;
  width: 100%;
  border-radius: 24px 24px 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.reason-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.reason {
  border: 1px solid #e0d8cd;
  border-radius: 12px;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
}

.reason-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
}
</style>
