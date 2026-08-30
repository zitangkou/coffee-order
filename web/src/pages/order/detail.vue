<template>
  <view class="page">
    <view v-if="loading" class="card page-state">订单加载中…</view>
    <view v-else-if="error" class="card page-state">
      <view>{{ error }}</view>
      <view class="btn-outline state-btn" @tap="goOrders">返回订单列表</view>
    </view>
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

    <view v-if="order?.status === 'UNPAID'" class="payment-actions">
      <!-- #ifdef MP-WEIXIN -->
      <view class="btn-primary action-btn" :class="{ disabled: paying }" @tap="retryPayment">
        {{ paying ? "支付确认中…" : "继续支付" }}
      </view>
      <!-- #endif -->
      <view class="btn-outline action-btn" :class="{ disabled: cancelling }" @tap="cancelOrder">
        {{ cancelling ? "取消中…" : "取消订单" }}
      </view>
    </view>

    <view v-if="order?.refunds?.length" class="card">
      <view class="spec-name">退款记录</view>
      <view class="o-row" v-for="r in order.refunds" :key="r.id">
        <text class="label">{{ refundStatusText(r.status) }}</text>
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
import { blockDisabledH5Customer } from "../../utils/customerAccess";
// #ifdef MP-WEIXIN
import { requestPayment } from "../../utils/platform";
// #endif

const order = ref<Order | null>(null);
const loading = ref(true);
const error = ref("");
const showRefund = ref(false);
const paying = ref(false);
const cancelling = ref(false);

function refundStatusText(status: string) {
  return ({
    PENDING: "审核中",
    PROCESSING: "退款处理中",
    SUCCESS: "退款成功",
    FAILED: "退款异常，请联系门店",
    REJECTED: "已拒绝",
    APPROVED: "历史已同意",
  } as Record<string, string>)[status] || status;
}
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
  if (blockDisabledH5Customer()) return;
  const id = Number((options as any)?.id);
  if (!Number.isInteger(id) || id <= 0) {
    error.value = "订单参数无效，请从订单列表重新进入";
    loading.value = false;
    return;
  }
  try {
    order.value = await api.getOrder(id);
    prevStatus = order.value.status;
    startPolling(id);
  } catch (e: any) {
    error.value = e.message || "订单加载失败，请稍后重试";
  } finally {
    loading.value = false;
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

function goOrders() {
  uni.redirectTo({ url: "/pages/order/list" });
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

async function retryPayment() {
  if (!order.value || paying.value) return;
  const orderId = order.value.id;
  paying.value = true;
  try {
    const payRes = await api.payOrder(orderId);
    if (!payRes.payParams) throw new Error("未获得支付参数");
    // #ifdef MP-WEIXIN
    const accepted = await requestPayment(payRes.payParams);
    if (!accepted) throw new Error("支付已取消");
    // #endif
    for (let i = 0; i < 12; i += 1) {
      const latest: Order = await api.confirmPayment(orderId);
      order.value = latest;
      if (["PAID", "MAKING", "READY", "COMPLETED"].includes(latest.status)) {
        uni.showToast({ title: "支付成功", icon: "success" });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("支付结果确认中，请稍后刷新订单");
  } catch (e: any) {
    uni.showToast({ title: e.message || "支付失败", icon: "none" });
  } finally {
    paying.value = false;
  }
}

async function cancelOrder() {
  if (!order.value || cancelling.value) return;
  cancelling.value = true;
  try {
    order.value = await api.cancelOrder(order.value.id);
    uni.showToast({ title: "订单已取消", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "取消失败", icon: "none" });
    try {
      order.value = await api.getOrder(order.value.id);
    } catch {
      // 保留当前页面状态，用户可稍后下拉或返回列表刷新。
    }
  } finally {
    cancelling.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page-state {
  text-align: center;
  color: #6b625b;
  padding: 56rpx 32rpx;
}

.state-btn {
  margin-top: 28rpx;
}

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

.payment-actions {
  display: flex;
  gap: 16rpx;
  margin: 24rpx 0;
}

.action-btn {
  flex: 1;
  text-align: center;
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
