<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="label">用餐方式</text>
        <view class="seg">
          <view
            class="seg-item"
            :class="user.orderType === 'DINE_IN' ? 'seg-active' : ''"
            @tap="setType('DINE_IN')"
          >
            堂食
          </view>
          <view
            class="seg-item"
            :class="user.orderType === 'TAKEOUT' ? 'seg-active' : ''"
            @tap="setType('TAKEOUT')"
          >
            外带
          </view>
        </view>
      </view>

      <view v-if="user.orderType === 'DINE_IN'" class="row">
        <text class="label">桌号</text>
        <view class="table-pick" @tap="showTablePicker = true">
          {{ user.tableNo || "请选择桌号" }}
        </view>
      </view>

      <view v-else class="row">
        <text class="label">手机号后四位</text>
        <input v-model="phone" class="input" placeholder="选填，取餐核对用" maxlength="4" />
      </view>
    </view>

    <view class="card">
      <view class="o-item" v-for="item in cart.items" :key="item.key">
        <view class="o-info">
          <view class="o-name">{{ item.name }} ×{{ item.quantity }}</view>
          <view class="o-specs">{{ specsText(item.specs) }}</view>
        </view>
        <text class="price">¥{{ item.unitPrice * item.quantity }}</text>
      </view>
      <view class="divider" />
      <view class="row">
        <text class="label">备注</text>
        <input v-model="cart.remark" class="input" placeholder="选填" />
      </view>
      <view class="row">
        <text class="label">包装费</text>
        <text class="sub">¥{{ packFee }}</text>
      </view>
      <view class="row total-row">
        <text class="label">合计</text>
        <text class="price big">¥{{ totalAmount }}</text>
      </view>
    </view>

    <view class="submit btn-primary" @tap="submit">提交订单</view>

    <view v-if="showTablePicker" class="mask" @tap="showTablePicker = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">选择桌号</view>
        <view class="table-grid">
          <view
            v-for="t in tables"
            :key="t.id"
            class="table-item"
            :class="user.tableId === t.id ? 'table-active' : ''"
            @tap="pickTable(t)"
          >
            {{ t.tableNo }}
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useUserStore } from "../../stores/user";
import type { Table } from "../../types";
// #ifdef MP-WEIXIN
import { requestPayment } from "../../utils/platform";
// #endif

const user = useUserStore();
const cart = useCartStore();
const tables = ref<Table[]>([]);
const phone = ref("");
const showTablePicker = ref(false);
const shop = ref<any>(null);

const packFee = computed(() => {
  if (user.orderType === "TAKEOUT") return shop.value?.packFee || 0;
  return 0;
});

const totalAmount = computed(
  () => Math.round((cart.total + packFee.value) * 100) / 100
);

onLoad(async () => {
  await user.ensureLogin();
  try {
    const [ts, s] = await Promise.all([api.getTables(), api.getShop()]);
    tables.value = ts;
    shop.value = s;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

function setType(type: "DINE_IN" | "TAKEOUT") {
  user.setOrderType(type);
}

function pickTable(t: Table) {
  user.setTable(t);
  showTablePicker.value = false;
}

function specsText(specs: Record<string, string | string[]>) {
  return Object.values(specs)
    .flat()
    .join(" / ");
}

async function submit() {
  if (!cart.items.length) {
    uni.showToast({ title: "购物车是空的", icon: "none" });
    return;
  }
  if (user.orderType === "DINE_IN" && !user.tableId) {
    uni.showToast({ title: "请选择桌号", icon: "none" });
    return;
  }
  if (user.orderType === "TAKEOUT" && shop.value?.takeoutPhoneRequired && phone.value.length !== 4) {
    uni.showToast({ title: "请填写手机号后四位", icon: "none" });
    return;
  }
  try {
    uni.showLoading({ title: "提交中" });
    const order = await api.createOrder({
      tableId: user.orderType === "DINE_IN" ? user.tableId || undefined : undefined,
      orderType: user.orderType,
      items: cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        specs: i.specs,
      })),
      remark: cart.remark || undefined,
      phone: phone.value || undefined,
    });
    let paid = null as any;
    // #ifdef MP-WEIXIN
    try {
      const payRes = await api.payOrder(order.id);
      if (payRes.payParams) {
        const okPay = await requestPayment(payRes.payParams);
        if (!okPay) {
          uni.hideLoading();
          uni.showToast({ title: "支付已取消", icon: "none" });
          uni.redirectTo({ url: "/pages/order/list" });
          return;
        }
        paid = await waitForPaid(order.id);
      }
    } catch (e: any) {
      uni.hideLoading();
      uni.showToast({ title: e.message || "支付失败", icon: "none" });
      uni.redirectTo({ url: "/pages/order/list" });
      return;
    }
    // #endif
    // #ifdef H5
    if (!paid) paid = await api.mockPay(order.id);
    // #endif
    if (!paid) throw new Error("支付结果确认中，请稍后在订单列表查看");
    cart.clear();
    uni.hideLoading();
    uni.redirectTo({ url: `/pages/order/result?id=${paid.id}` });
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "下单失败", icon: "none" });
  }
}

async function waitForPaid(orderId: number) {
  for (let i = 0; i < 12; i += 1) {
    const current = await api.confirmPayment(orderId);
    if (current.status === "PAID") return current;
    if (["CANCELLED", "REFUNDED"].includes(current.status)) {
      throw new Error("订单状态已变化，请在订单列表查看");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}
</script>

<style lang="scss" scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
}

.label {
  color: #4a3d31;
  font-weight: 600;
}

.sub {
  color: #6b625b;
}

.seg {
  display: flex;
  border: 1px solid #e0d8cd;
  border-radius: 12px;
  overflow: hidden;
}

.seg-item {
  padding: 10rpx 32rpx;
  font-size: 26rpx;
  color: #6b625b;
}

.seg-active {
  background: #2f2a26;
  color: #fff;
}

.table-pick {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 12rpx 24rpx;
  color: #4a3d31;
  font-size: 26rpx;
}

.input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 12rpx 20rpx;
  font-size: 26rpx;
  width: 380rpx;
  text-align: right;
}

.o-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}

.o-name {
  font-size: 28rpx;
}

.o-specs {
  color: #6b625b;
  font-size: 22rpx;
}

.total-row {
  margin-top: 8rpx;
}

.big {
  font-size: 40rpx;
}

.submit {
  margin: 32rpx 0;
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

.table-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.table-item {
  width: 150rpx;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 12px;
  border: 1px solid #e0d8cd;
  font-size: 28rpx;
}

.table-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
}
</style>
