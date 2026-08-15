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
      <view class="metric"><text class="m-num refund">{{ refunds.count || 0 }}</text><text class="m-label">退款</text></view>
    </view>

    <view class="card">
      <view class="section-title">近 7 天营收趋势</view>
      <view class="trend-row" v-for="t in trend" :key="t.date">
        <text class="trend-label">{{ t.date }}</text>
        <view class="trend-track">
          <view class="trend-bar" :style="{ width: trendWidth(t.revenue) + '%' }" />
        </view>
        <text class="trend-value">¥{{ t.revenue }}</text>
      </view>
      <view v-if="!trend.length" class="empty">暂无数据</view>
    </view>

    <view class="card">
      <view class="section-title">品类销售占比</view>
      <view class="cat-row" v-for="(c, idx) in categories" :key="c.name">
        <view class="cat-head">
          <text class="cat-name">{{ idx + 1 }}. {{ c.name }}</text>
          <text class="cat-val">¥{{ c.revenue }} · {{ c.qty }} 件</text>
        </view>
        <view class="cat-track">
          <view class="cat-bar" :style="{ width: catWidth(c.revenue) + '%' }" />
        </view>
      </view>
      <view v-if="!categories.length" class="empty">暂无数据</view>
    </view>

    <view class="card">
      <view class="section-title">热销排行</view>
      <view class="rank" v-for="(p, idx) in ranking" :key="p.productId">
        <text class="rank-no">{{ idx + 1 }}</text>
        <view class="rank-info">
          <view class="rank-name">{{ p.name }}</view>
          <view class="text-sub">销量 {{ p.qty }} · ¥{{ p.amount }}</view>
        </view>
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

    <view class="btn-outline export-btn" @tap="exportCsv">导出数据（CSV，可用 Excel 打开）</view>
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
const trend = ref<any[]>([]);
const categories = ref<any[]>([]);
const refunds = ref<any>({});
let maxHour = 1;

onShow(() => load());

async function load() {
  try {
    const [s, r, h, t, c, rf] = await Promise.all([
      api.adminStatsSummary(range.value),
      api.adminStatsProducts(range.value),
      api.adminStatsHours(),
      api.adminStatsTrend(7),
      api.adminStatsCategories(range.value),
      api.adminStatsRefunds(range.value),
    ]);
    summary.value = s;
    ranking.value = r;
    hours.value = h;
    trend.value = t;
    categories.value = c;
    refunds.value = rf;
    maxHour = Math.max(1, ...h.map((x) => x.count));
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function switchRange(v: string) {
  range.value = v;
  load();
}

function trendWidth(revenue: number) {
  const max = Math.max(1, ...trend.value.map((t) => t.revenue));
  return Math.round((revenue / max) * 100);
}

function catWidth(revenue: number) {
  const max = Math.max(1, ...categories.value.map((c) => c.revenue));
  return Math.round((revenue / max) * 100);
}

function hourWidth(count: number) {
  return Math.round((count / maxHour) * 100);
}

function exportCsv() {
  const rows: string[][] = [
    ["指标", "值"],
    ["统计范围", range.value],
    ["营收", String(summary.value.revenue ?? 0)],
    ["订单数", String(summary.value.orderCount ?? 0)],
    ["客单价", String(summary.value.avgTicket ?? 0)],
    ["退款笔数", String(refunds.value.count ?? 0)],
    ["退款金额", String(refunds.value.amount ?? 0)],
    [],
    ["品类", "销售额", "件数"],
    ...categories.value.map((c) => [c.name, String(c.revenue), String(c.qty)]),
    [],
    ["商品", "销量", "销售额"],
    ...ranking.value.map((p) => [p.name, String(p.qty), String(p.amount)]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  // #ifdef H5
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `coffee-stats-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  // #endif
  // #ifndef H5
  uni.showToast({ title: "请在电脑端导出 CSV", icon: "none" });
  // #endif
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
  font-size: 34rpx;
  font-weight: 700;
}

.m-label {
  color: #6b625b;
  font-size: 22rpx;
}

.m-num.refund {
  color: #b04a3a;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 20rpx;
}

.trend-row,
.cat-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;
}

.trend-label {
  width: 90rpx;
  font-size: 22rpx;
  color: #6b625b;
}

.trend-track,
.cat-track {
  flex: 1;
  background: #f0e9df;
  border-radius: 8px;
  height: 20rpx;
}

.trend-bar {
  background: #2f2a26;
  border-radius: 8px;
  height: 20rpx;
  min-width: 4rpx;
}

.cat-bar {
  background: #c4a484;
  border-radius: 8px;
  height: 20rpx;
  min-width: 4rpx;
}

.trend-value {
  width: 110rpx;
  text-align: right;
  font-size: 22rpx;
}

.cat-head {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 6rpx;
}

.cat-name {
  font-size: 26rpx;
  font-weight: 600;
}

.cat-val {
  font-size: 22rpx;
  color: #6b625b;
}

.cat-row {
  flex-direction: column;
  align-items: stretch;
  padding: 12rpx 0;
}

.rank {
  display: flex;
  align-items: center;
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
}

.rank-name {
  font-size: 28rpx;
  font-weight: 600;
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

.export-btn {
  margin-top: 8rpx;
}
</style>
