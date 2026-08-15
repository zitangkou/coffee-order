<template>
  <view class="page result">
    <view class="card center">
      <view class="check">✓</view>
      <view class="title">支付成功</view>
      <view class="sub">订单号 {{ order?.orderNo }}</view>
      <view class="divider" />
      <view class="pickup-label">取餐码</view>
      <view class="pickup-code">{{ order?.pickupNo }}</view>
      <view class="sub">预计制作时间 10 分钟</view>
      <view class="btn-primary view-btn" @tap="goDetail">查看订单</view>
      <view class="btn-outline back-btn" @tap="goHome">返回首页</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Order } from "../../types";
// #ifdef MP-WEIXIN
import { WX_SUBSCRIBE_TEMPLATE_READY } from "../../config";
import { subscribeMessage } from "../../utils/platform";
// #endif

const order = ref<Order | null>(null);

onLoad(async (options) => {
  const id = Number((options as any)?.id);
  try {
    order.value = await api.getOrder(id);
    // #ifdef MP-WEIXIN
    requestSubscribe();
    // #endif
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

// #ifdef MP-WEIXIN
async function requestSubscribe() {
  try {
    const tmpl = WX_SUBSCRIBE_TEMPLATE_READY;
    if (!tmpl || tmpl.startsWith("your_")) return;
    const accepted = await subscribeMessage(tmpl);
    if (accepted) {
      await api.saveSubscribe(tmpl);
      uni.showToast({ title: "出餐通知已开启", icon: "none" });
    }
  } catch (e) {
    console.warn("[wx] 订阅引导失败", e);
  }
}
// #endif

function goDetail() {
  uni.redirectTo({ url: `/pages/order/detail?id=${order.value?.id}` });
}

function goHome() {
  uni.reLaunch({ url: "/pages/index/index" });
}
</script>

<style lang="scss" scoped>
.result {
  padding-top: 80rpx;
}

.center {
  text-align: center;
  padding: 64rpx 32rpx;
}

.check {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #3e7c59;
  color: #fff;
  font-size: 52rpx;
  line-height: 96rpx;
  margin: 0 auto 24rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
}

.sub {
  color: #6b625b;
  font-size: 24rpx;
  margin-top: 12rpx;
}

.pickup-label {
  color: #6b625b;
  font-size: 24rpx;
  margin-top: 16rpx;
}

.pickup-code {
  font-size: 96rpx;
  font-weight: 800;
  letter-spacing: 8rpx;
  color: #2f2a26;
  margin: 8rpx 0;
}

.view-btn {
  margin-top: 40rpx;
}

.back-btn {
  margin-top: 20rpx;
}
</style>
