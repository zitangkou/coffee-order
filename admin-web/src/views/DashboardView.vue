<template>
  <div v-loading="loading" class="dashboard-page">
    <div class="page-heading">
      <div>
        <h1>今日经营概览</h1>
        <p>{{ todayLabel }} · 数据按北京时间统计</p>
      </div>
      <el-button @click="load">刷新数据</el-button>
    </div>
    <section class="kpi-grid">
      <KpiCard
        label="今日营业额"
        :value="money(stats.revenue)"
        prefix="¥"
        hint="成功支付订单"
        icon="¥"
        tone="brown"
      />
      <KpiCard
        label="今日订单"
        :value="stats.orderCount"
        hint="已支付订单数"
        icon="单"
        tone="blue"
      />
      <KpiCard
        label="平均客单价"
        :value="money(stats.avgTicket)"
        prefix="¥"
        hint="营业额 / 订单数"
        icon="均"
        tone="green"
      />
      <KpiCard
        label="退款金额"
        :value="money(refunds.amount)"
        prefix="¥"
        :hint="`${refunds.count} 笔成功退款`"
        icon="退"
        tone="red"
      />
    </section>
    <section class="status-strip">
      <button @click="goOrders('PAID')">
        <span class="status-number">{{ stats.pending }}</span
        ><span>待接单</span>
      </button>
      <button @click="goOrders('MAKING')">
        <span class="status-number">{{ stats.making }}</span
        ><span>制作中</span>
      </button>
      <button @click="goOrders('READY')">
        <span class="status-number">{{ stats.ready }}</span
        ><span>待取餐</span>
      </button>
      <div class="status-message">
        <span class="live-dot" />订单工作台每 10 秒自动刷新
      </div>
    </section>
    <section class="dashboard-grid">
      <article class="panel chart-panel">
        <div class="panel-title">
          <div>
            <h2>近 7 天营业趋势</h2>
            <p>营业额与订单量</p>
          </div>
        </div>
        <div ref="chartEl" class="trend-chart" />
      </article>
      <article class="panel ranking-panel">
        <div class="panel-title">
          <div>
            <h2>今日热销商品</h2>
            <p>按销售数量排序</p>
          </div>
        </div>
        <div v-if="ranking.length" class="ranking-list">
          <div
            v-for="(item, index) in ranking.slice(0, 6)"
            :key="item.productId"
            class="rank-row"
          >
            <span class="rank-index">{{ index + 1 }}</span>
            <div>
              <strong>{{ item.name }}</strong
              ><small>销售额 ¥{{ money(item.amount) }}</small>
            </div>
            <span>{{ item.qty }} 杯</span>
          </div>
        </div>
        <el-empty v-else description="今日暂无销售数据" :image-size="70" />
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import { init, use, type ECharts } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { api } from "../api";
import KpiCard from "../components/KpiCard.vue";
import type { ProductRank, TodayStats, TrendPoint } from "../types";

use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
const router = useRouter();
const loading = ref(false);
const chartEl = ref<HTMLElement>();
let chart: ECharts | null = null;
const stats = reactive<TodayStats>({
  revenue: 0,
  orderCount: 0,
  avgTicket: 0,
  pending: 0,
  making: 0,
  ready: 0,
});
const refunds = reactive({ count: 0, amount: 0 });
const trend = ref<TrendPoint[]>([]);
const ranking = ref<ProductRank[]>([]);
const todayLabel = computed(() =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date()),
);
function money(value: number) {
  return Number(value || 0).toFixed(2);
}
function goOrders(status: string) {
  router.push({ path: "/orders", query: { status } });
}
function drawChart() {
  if (!chartEl.value) return;
  chart ||= init(chartEl.value);
  chart.setOption({
    grid: { left: 18, right: 22, top: 24, bottom: 20, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: trend.value.map((x) => x.date.slice(5)),
      axisLine: { lineStyle: { color: "#ded8d1" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        axisLabel: { formatter: "¥{value}" },
        splitLine: { lineStyle: { color: "#f0ece7" } },
      },
      { type: "value", show: false },
    ],
    series: [
      {
        name: "营业额",
        type: "line",
        smooth: true,
        data: trend.value.map((x) => x.revenue),
        lineStyle: { width: 3, color: "#6f4e37" },
        itemStyle: { color: "#6f4e37" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(111,78,55,.25)" },
              { offset: 1, color: "rgba(111,78,55,0)" },
            ],
          },
        },
      },
      {
        name: "订单量",
        type: "bar",
        yAxisIndex: 1,
        barWidth: 12,
        data: trend.value.map((x) => x.orderCount),
        itemStyle: { color: "#d7b58c", borderRadius: [4, 4, 0, 0] },
      },
    ],
  });
}
async function load() {
  loading.value = true;
  try {
    const [s, t, r, rf] = await Promise.all([
      api.today(),
      api.trend(7),
      api.productsRank(),
      api.refundStats(),
    ]);
    Object.assign(stats, s);
    trend.value = t;
    ranking.value = r;
    Object.assign(refunds, rf);
    await nextTick();
    drawChart();
  } catch (e: any) {
    ElMessage.error(e.message || "看板加载失败");
  } finally {
    loading.value = false;
  }
}
function resize() {
  chart?.resize();
}
onMounted(() => {
  load();
  window.addEventListener("resize", resize);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
});
</script>
