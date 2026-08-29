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
      <!-- #ifdef MP-WEIXIN -->
      <view
        v-if="canSubscribe"
        class="btn-outline subscribe-btn"
        :class="{ disabled: subscribing }"
        @tap="requestSubscribe"
      >
        {{ subscribing ? "设置中…" : subscribeButtonText }}
      </view>
      <!-- #endif -->
      <view class="btn-primary view-btn" @tap="goDetail">查看订单</view>
      <view class="btn-outline back-btn" @tap="goHome">返回首页</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import type { Order } from "../../types";
// #ifdef MP-WEIXIN
import { WX_SUBSCRIBE_TEMPLATE_READY } from "../../config";
import { subscribeMessage } from "../../utils/platform";
// #endif

const order = ref<Order | null>(null);
const subscribing = ref(false);
const subscribeStatus = ref<"" | "ACCEPTED" | "REJECTED" | "BANNED">("");

// #ifdef MP-WEIXIN
const canSubscribe = computed(
  () => !!WX_SUBSCRIBE_TEMPLATE_READY && !WX_SUBSCRIBE_TEMPLATE_READY.startsWith("your_")
);
const subscribeButtonText = computed(() => {
  if (subscribeStatus.value === "ACCEPTED") return "已开启出餐通知";
  if (subscribeStatus.value === "BANNED") return "通知已被系统禁用";
  if (subscribeStatus.value === "REJECTED") return "重新开启出餐通知";
  return "开启出餐通知";
});
// #endif

onLoad(async (options) => {
  const id = Number((options as any)?.id);
  try {
    order.value = await api.getOrder(id);
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

// #ifdef MP-WEIXIN
async function requestSubscribe() {
  if (subscribing.value || subscribeStatus.value === "ACCEPTED") return;
  subscribing.value = true;
  try {
    const tmpl = WX_SUBSCRIBE_TEMPLATE_READY;
    if (!tmpl || tmpl.startsWith("your_")) return;
    const status = await subscribeMessage(tmpl);
    if (status !== "ERROR") {
      subscribeStatus.value = status;
      await api.saveSubscribe(tmpl, status);
    }
    if (status === "ACCEPTED") {
      uni.showToast({ title: "出餐通知已开启", icon: "none" });
    } else if (status === "BANNED") {
      uni.showToast({ title: "请在微信设置中开启通知", icon: "none" });
    } else if (status === "REJECTED") {
      uni.showToast({ title: "已暂不开启通知", icon: "none" });
    }
  } catch (e) {
    uni.showToast({ title: "通知设置失败，请稍后重试", icon: "none" });
  } finally {
    subscribing.value = false;
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

.subscribe-btn {
  margin-top: 32rpx;
}

.back-btn {
  margin-top: 20rpx;
}
</style>
