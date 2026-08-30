<template>
  <view class="page">
    <view v-if="cart.items.length" class="card" v-for="item in cart.items" :key="item.key">
      <view class="item">
        <view class="item-main">
          <view class="item-name">{{ item.name }}</view>
          <view class="item-specs">{{ specsText(item.specs) }}</view>
          <view class="price">¥{{ item.unitPrice }}</view>
        </view>
        <view class="stepper">
          <view class="step-btn" @tap="cart.setQuantity(item.key, item.quantity - 1)">−</view>
          <text class="qty">{{ item.quantity }}</text>
          <view class="step-btn" @tap="cart.setQuantity(item.key, item.quantity + 1)">＋</view>
        </view>
      </view>
      <view class="item-actions">
        <text class="link" @tap="cart.remove(item.key)">删除</text>
      </view>
    </view>

    <view v-if="!cart.items.length" class="empty">购物车还是空的，去挑一杯喜欢的咖啡吧</view>

    <view class="card" v-if="cart.items.length">
      <view class="spec-name">整单备注</view>
      <input v-model="cart.remark" class="remark" placeholder="备注给咖啡师" />
    </view>

    <view v-if="cart.items.length" class="bottom-bar">
      <view class="total">
        <text class="text-sub">合计</text>
        <text class="price total-price">¥{{ cart.total }}</text>
      </view>
      <view class="cart-btn" @tap="goCheckout">去结算</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { useCartStore } from "../../stores/cart";
import { blockDisabledH5Customer } from "../../utils/customerAccess";

const cart = useCartStore();

onLoad(() => blockDisabledH5Customer());

function specsText(specs: Record<string, string | string[]>) {
  return Object.values(specs)
    .flat()
    .join(" / ");
}

function goCheckout() {
  uni.navigateTo({ url: "/pages/order/create" });
}
</script>

<style lang="scss" scoped>
.page {
  padding-bottom: 180rpx;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-name {
  font-size: 30rpx;
  font-weight: 600;
}

.item-specs {
  color: #6b625b;
  font-size: 24rpx;
  margin: 6rpx 0;
}

.item-actions {
  margin-top: 16rpx;
  text-align: right;
}

.link {
  color: #b04a3a;
  font-size: 24rpx;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.step-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 1px solid #e0d8cd;
  text-align: center;
  line-height: 52rpx;
  font-size: 30rpx;
}

.qty {
  min-width: 36rpx;
  text-align: center;
  font-weight: 600;
}

.spec-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.remark {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
}

.total-price {
  font-size: 40rpx;
  margin-left: 12rpx;
}

.cart-btn {
  background: #2f2a26;
  color: #fff;
  border-radius: 24px;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0 56rpx;
  font-weight: 600;
}
</style>
