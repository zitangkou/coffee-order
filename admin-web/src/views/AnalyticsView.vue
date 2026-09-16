<template>
  <div>
    <div class="page-heading"><div><h1>数据分析</h1><p>统一查看营业、商品、品类、时段与退款数据</p></div><div class="heading-actions"><el-select v-model="range" @change="changeRange"><el-option label="今天" value="today" /><el-option label="昨天" value="yesterday" /><el-option label="近 7 天" value="last7" /><el-option label="近 30 天" value="last30" /><el-option label="本月" value="month" /><el-option label="自定义" value="custom" /></el-select><el-date-picker v-if="range === 'custom'" v-model="customRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" @change="load" /><el-button @click="exportCsv">导出 CSV</el-button></div></div>
    <section class="kpi-grid" v-loading="loading">
      <KpiCard label="营业额" :value="money(overview.grossRevenue)" prefix="¥" :hint="comparisonHint" icon="¥" tone="brown" />
      <KpiCard label="净收入" :value="money(overview.netRevenue)" prefix="¥" hint="营业额减成功退款" icon="净" tone="green" />
      <KpiCard label="订单数" :value="overview.orderCount" :hint="`堂食 ${overview.dineInCount} · 外带 ${overview.takeoutCount}`" icon="单" tone="blue" />
      <KpiCard label="退款率" :value="overview.refundRate.toFixed(2)" suffix="%" :hint="`${overview.refundCount} 笔 · ¥${money(overview.refundAmount)}`" icon="退" tone="red" />
    </section>
    <section class="analytics-grid">
      <article class="panel"><div class="panel-title"><div><h2>热销商品</h2><p>按销量排序</p></div></div><el-table :data="products" size="small"><el-table-column type="index" width="55" /><el-table-column prop="name" label="商品" /><el-table-column prop="qty" label="销量" width="90" /><el-table-column label="销售额" width="120"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column></el-table></article>
      <article class="panel"><div class="panel-title"><div><h2>品类贡献</h2><p>按销售额排序</p></div></div><el-table :data="categories" size="small"><el-table-column prop="name" label="品类" /><el-table-column prop="qty" label="销量" width="90" /><el-table-column label="销售额" width="120"><template #default="{ row }">¥{{ money(row.revenue) }}</template></el-table-column></el-table></article>
      <article class="panel analytics-wide"><div class="panel-title"><div><h2>时段分布</h2><p>所选范围内按支付成功订单统计</p></div></div><div ref="chartEl" class="analytics-chart" /></article>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import { init, use, type ECharts } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { api } from "../api";
import KpiCard from "../components/KpiCard.vue";
import type { ProductRank, StatsOverview } from "../types";
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const range = ref("today"); const customRange = ref<[Date, Date] | null>(null); const loading = ref(false); const overview = reactive<StatsOverview>({ startAt: "", endAt: "", grossRevenue: 0, refundAmount: 0, netRevenue: 0, orderCount: 0, avgTicket: 0, refundCount: 0, refundRate: 0, dineInCount: 0, takeoutCount: 0 }); const previousRevenue = ref(0); const products = ref<ProductRank[]>([]); const categories = ref<Array<{ name: string; revenue: number; qty: number }>>([]); const hours = ref<Array<{ hour: string; count: number }>>([]); const chartEl = ref<HTMLElement>(); let chart: ECharts | null = null;
const comparisonHint = computed(() => { if (!previousRevenue.value) return "上期暂无数据"; const change = ((overview.grossRevenue - previousRevenue.value) / previousRevenue.value) * 100; return `较上期 ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`; });
function money(value: number) { return Number(value || 0).toFixed(2); }
function draw() { if (!chartEl.value) return; chart ||= init(chartEl.value); chart.setOption({ grid: { left: 24, right: 20, top: 20, bottom: 25, containLabel: true }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: hours.value.map(i => i.hour), axisLabel: { interval: 2 } }, yAxis: { type: "value", minInterval: 1 }, series: [{ type: "bar", data: hours.value.map(i => i.count), itemStyle: { color: "#8b6347", borderRadius: [4, 4, 0, 0] } }] }); }
function selectedRange() { const now = new Date(); const end = new Date(now); let start = new Date(now); if (range.value === "yesterday") { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999); } else if (range.value === "last7") { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); } else if (range.value === "last30") { start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); } else if (range.value === "month") { start = new Date(now.getFullYear(), now.getMonth(), 1); } else if (range.value === "custom" && customRange.value) { start = new Date(customRange.value[0]); start.setHours(0, 0, 0, 0); end.setTime(customRange.value[1].getTime()); end.setHours(23, 59, 59, 999); } else { start.setHours(0, 0, 0, 0); } return { start, end }; }
function changeRange() { if (range.value !== "custom" || customRange.value) load(); }
async function load() { if (range.value === "custom" && !customRange.value) return; loading.value = true; try { const { start, end } = selectedRange(); const startAt = start.toISOString(); const endAt = end.toISOString(); const span = end.getTime() - start.getTime(); const previousEnd = new Date(start.getTime() - 1); const previousStart = new Date(previousEnd.getTime() - span); const [current, previous, p, c, h] = await Promise.all([api.statsOverview(startAt, endAt), api.statsOverview(previousStart.toISOString(), previousEnd.toISOString()), api.productsRank("today", startAt, endAt), api.categoryStats("today", startAt, endAt), api.hourlyStats(startAt, endAt)]); Object.assign(overview, current); previousRevenue.value = previous.grossRevenue; products.value = p; categories.value = c; hours.value = h; await nextTick(); draw(); } catch (e: any) { ElMessage.error(e.message || "统计加载失败"); } finally { loading.value = false; } }
function csvCell(value: unknown) { const text = String(value ?? ""); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; }
function exportCsv() { const rows = [["指标", "数值"], ["营业额", overview.grossRevenue], ["净收入", overview.netRevenue], ["订单数", overview.orderCount], ["客单价", overview.avgTicket], ["退款金额", overview.refundAmount], ["退款率", `${overview.refundRate}%`], [], ["商品", "销量", "销售额"], ...products.value.map(i => [i.name, i.qty, i.amount])]; const blob = new Blob(["\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `coffee-os-${range.value}.csv`; link.click(); URL.revokeObjectURL(url); }
function resize() { chart?.resize(); }
onMounted(() => { load(); window.addEventListener("resize", resize); }); onBeforeUnmount(() => { window.removeEventListener("resize", resize); chart?.dispose(); });
</script>
