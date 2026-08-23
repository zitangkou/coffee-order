<template>
  <view class="page">
    <view v-if="profile" class="card hero">
      <view class="avatar">{{ profile.user.nickname?.slice(0, 1) || "咖" }}</view>
      <view class="hero-info">
        <view class="level-badge">
          {{ profile.member.level.current.badge }} {{ profile.member.level.current.name }}
        </view>
        <view class="phone">{{ maskPhone(profile.user.phone) }}</view>
      </view>
    </view>

    <view v-if="profile && !profile.user.phoneVerified" class="card">
      <view class="section-title">绑定手机号，开启咖啡档案</view>
      <view class="f-label">手机号</view>
      <view class="row">
        <input v-model="phone" class="input flex1" type="number" maxlength="11" placeholder="11 位手机号" />
        <view class="mini-btn" :class="{ disabled: countdown > 0 }" @tap="sendCode">
          {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
        </view>
      </view>
      <view class="f-label">验证码</view>
      <input v-model="code" class="input" type="number" maxlength="6" placeholder="6 位验证码" />
      <view class="btn-primary bind-btn" @tap="bind">绑定手机号</view>
      <view v-if="profile.user.phone" class="text-sub">当前未验证号码：{{ maskPhone(profile.user.phone) }}</view>
    </view>

    <template v-if="profile && profile.user.phoneVerified">
      <view class="card stats">
        <view class="stat"><text class="s-num">¥{{ profile.member.totalSpent }}</text><text class="s-label">累计消费</text></view>
        <view class="stat"><text class="s-num">{{ profile.member.orderCount }}</text><text class="s-label">消费次数</text></view>
        <view class="stat">
          <text class="s-num">{{ lastOrderText }}</text>
          <text class="s-label">最近消费</text>
        </view>
      </view>

      <view class="card" v-if="profile.member.level.next">
        <view class="progress-row">
          <text class="text-sub">距「{{ profile.member.level.next.name }}」还需 ¥{{ profile.member.level.next.minSpend - profile.member.totalSpent }}</text>
          <text class="text-sub">{{ profile.member.level.progress }}%</text>
        </view>
        <view class="progress-track"><view class="progress-bar" :style="{ width: profile.member.level.progress + '%' }" /></view>
      </view>

      <view class="card" v-if="profile.member.recentOrders.length">
        <view class="section-title">消费记录</view>
        <view class="order" v-for="o in profile.member.recentOrders" :key="o.id" @tap="goOrder(o.id)">
          <view class="o-top">
            <text class="o-items">{{ o.items.map((i: any) => `${i.productName}×${i.quantity}`).join("、") }}</text>
            <text class="price">¥{{ o.totalAmount }}</text>
          </view>
          <view class="o-bottom">
            <text class="text-sub">{{ timeText(o.createdAt) }}</text>
            <text class="badge" :class="statusClass(o.status)">{{ statusText(o.status) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="card empty">还没有消费记录，去点一杯咖啡吧</view>
    </template>

    <view class="legal-links">
      <text @tap="goLegal('privacy')">隐私政策</text>
      <text class="dot">·</text>
      <text @tap="goLegal('terms')">用户服务协议</text>
    </view>

    <view v-if="!profile" class="empty">加载中...</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useUserStore } from "../../stores/user";
import { ORDER_STATUS_TEXT, type OrderStatus } from "../../types";

const user = useUserStore();
const profile = ref<any>(null);
const phone = ref("");
const code = ref("");
const countdown = ref(0);
let timer: any = null;

const lastOrderText = computed(() =>
  profile.value?.member.lastOrderAt
    ? (profile.value.member.lastOrderAt as string).replace("T", " ").slice(5, 16)
    : "—"
);

onLoad(async () => {
  await user.ensureLogin();
  load();
});

onUnload(() => {
  if (timer) clearInterval(timer);
});

async function load() {
  try {
    profile.value = await api.userProfile();
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

async function sendCode() {
  if (countdown.value > 0) return;
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    uni.showToast({ title: "手机号格式不正确", icon: "none" });
    return;
  }
  try {
    const data = await api.sendSmsCode(phone.value);
    uni.showToast({
      title: data.devCode ? `测试验证码：${data.devCode}` : "验证码已发送",
      icon: "none",
      duration: 3000,
    });
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch (e: any) {
    uni.showToast({ title: e.message || "发送失败", icon: "none" });
  }
}

async function bind() {
  if (!/^1[3-9]\d{9}$/.test(phone.value) || !/^\d{6}$/.test(code.value)) {
    uni.showToast({ title: "请填写正确的手机号和验证码", icon: "none" });
    return;
  }
  try {
    uni.showLoading({ title: "绑定中" });
    profile.value = await api.bindPhone(phone.value, code.value);
    uni.hideLoading();
    uni.showToast({ title: "绑定成功", icon: "success" });
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "绑定失败", icon: "none" });
  }
}

function maskPhone(p?: string) {
  return p ? p.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") : "未绑定";
}

function timeText(t: string) {
  return (t || "").replace("T", " ").slice(5, 16);
}

function statusText(s: OrderStatus) {
  return ORDER_STATUS_TEXT[s] || s;
}

function statusClass(s: OrderStatus) {
  const map: Record<string, string> = {
    PAID: "badge-primary",
    MAKING: "badge-accent",
    READY: "badge-success",
    COMPLETED: "badge-grey",
  };
  return map[s] || "badge-grey";
}

function goOrder(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` });
}

function goLegal(page: "privacy" | "terms") {
  uni.navigateTo({ url: `/pages/legal/${page}` });
}
</script>

<style lang="scss" scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: linear-gradient(160deg, #2f2a26, #4a3d31);
}

.legal-links {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  padding: 28rpx 0 calc(28rpx + env(safe-area-inset-bottom));
  color: #7a6c60;
  font-size: 24rpx;
}

.dot {
  color: #b7aaa0;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #c4a484;
  color: #fff;
  font-size: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.level-badge {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
}

.phone {
  color: #d8c9b6;
  font-size: 24rpx;
  margin-top: 8rpx;
}

.f-label {
  font-size: 24rpx;
  color: #6b625b;
  margin: 16rpx 0 8rpx;
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.flex1 {
  flex: 1;
}

.input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.mini-btn {
  border: 1px solid #2f2a26;
  color: #2f2a26;
  border-radius: 24px;
  padding: 14rpx 24rpx;
  font-size: 24rpx;
  white-space: nowrap;
}

.disabled {
  opacity: 0.4;
}

.bind-btn {
  margin-top: 24rpx;
}

.stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.s-num {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
}

.s-label {
  color: #6b625b;
  font-size: 22rpx;
}

.progress-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.progress-track {
  height: 16rpx;
  background: #f0e9df;
  border-radius: 8px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #c4a484;
  border-radius: 8px;
}

.order {
  padding: 16rpx 0;
  border-bottom: 1px solid #e8e2db;
}

.order:last-child {
  border-bottom: none;
}

.o-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.o-items {
  font-size: 26rpx;
  color: #4a3d31;
}

.o-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8rpx;
}
</style>
