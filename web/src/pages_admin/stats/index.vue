<template>
  <view class="page">
    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <view
        v-for="r in ranges"
        :key="r.value"
        class="tab"
        :class="range === r.value ? 'tab-active' : ''"
        @tap="switchRange(r.value)"
      >
        {{ r.label }}
      </view>
    </scroll-view>

    <view class="card summary">
      <view class="metric"><text class="m-num">¥{{ summary.revenue || 0 }}</text><text class="m-label">营收</text></view>
      <view class="metric"><text class="m-num">{{ summary.orderCount || 0 }}</text><text class="m-label">订单</text></view>
      <view class="metric"><text class="m-num">{{ summary.avgTicket || 0 }}</text><text class="m-label">客单价</text></view>
    </view>

    <view class="card">
      <view class="section-title">热销排行</view>
      <view class="rank" v-for="(p, idx) in ranking" :key="p.productId">
        <text class="rank-no">{{ idx + 1 }}</text>
        <view class="rank-info">
          <view class="rank-name">{{ p.name }}</view>
          <view class="text-sub">销量 {{ p.qty }} · ¥{{ p.amount }}</view>
        </view>
        <view class="rank-bar" :style="{ width: barWidth(p.qty) + '%' }" />
      </view>
      <view v-if="!ranking.length" class="empty">暂无数据</view>
    </view>

    <view class="card">
      <view class="section-title">时段分布</view>
      <view class="hour-row" v-for="h in hours" :key="h.hour">
        <text class="hour-label">{{ h.hour }}</text>
        <view class="hour-track">
          <view class="hour-bar" :style="{ width: hourWidth(h.count) + '%' }" />
        </view>
        <text class="hour-count">{{ h.count }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";

const ranges = [
  { label: "今日", value: "today" },
  { label: "本周", value: "week" },
  { label: "本月", value: "month" },
];
const range = ref("today");
const summary = ref<any>({});
const ranking = ref<any[]>([]);
const hours = ref<any[]>([]);
let maxHour = 1;

onShow(() => load());

async function load() {
  try {
    const [s, r, h] = await Promise.all([
      api.adminStatsSummary(range.value),
      api.adminStatsProducts(range.value),
      api.adminStatsHours(),
    ]);
    summary.value = s;
    ranking.value = r;
    hours.value = h;
    maxHour = Math.max(1, ...h.map((x) => x.count));
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function switchRange(v: string) {
  range.value = v;
  load();
}

function barWidth(qty: number) {
  const max = Math.max(1, ...ranking.value.map((p) => p.qty));
  return Math.round((qty / max) * 100);
}

function hourWidth(count: number) {
  return Math.round((count / maxHour) * 100);
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

.summary {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.m-num {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
}

.m-label {
  color: #6b625b;
  font-size: 22rpx;
}

.rank {
  display: flex;
  align-items: center;
  position: relative;
  padding: 12rpx 0;
}

.rank-no {
  width: 44rpx;
  height: 44rpx;
  background: #f0e9df;
  border-radius: 50%;
  text-align: center;
  line-height: 44rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #6b4f2f;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.rank-info {
  flex: 1;
  z-index: 1;
}

.rank-name {
  font-size: 28rpx;
  font-weight: 600;
}

.rank-bar {
  position: absolute;
  left: 0;
  height: 100%;
  background: rgba(196, 164, 132, 0.22);
  border-radius: 8px;
  max-width: 100%;
}

.hour-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;
}

.hour-label {
  width: 90rpx;
  font-size: 22rpx;
  color: #6b625b;
}

.hour-track {
  flex: 1;
  background: #f0e9df;
  border-radius: 8px;
  height: 20rpx;
}

.hour-bar {
  background: #c4a484;
  border-radius: 8px;
  height: 20rpx;
  min-width: 4rpx;
}

.hour-count {
  width: 60rpx;
  text-align: right;
  font-size: 22rpx;
}
</style>
