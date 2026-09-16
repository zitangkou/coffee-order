<template>
  <div>
    <div class="page-heading"><div><h1>会员管理</h1><p>查看顾客消费概览，敏感信息默认脱敏</p></div></div>
    <article class="panel">
      <div class="product-toolbar">
        <div class="member-search"><el-input v-model="keyword" clearable placeholder="搜索昵称或手机号" @keyup.enter="search" /><el-button type="primary" @click="search">查询</el-button></div>
      </div>
      <el-table v-loading="loading" :data="members" stripe height="calc(100vh - 290px)" @row-click="openMember">
        <el-table-column label="会员" min-width="190"><template #default="{ row }"><strong>{{ row.nickname }}</strong><small class="member-phone">{{ row.phone || '未绑定手机号' }}</small></template></el-table-column>
        <el-table-column label="累计消费" width="130"><template #default="{ row }"><strong>¥{{ money(row.totalSpent) }}</strong></template></el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="100" />
        <el-table-column label="客单价" width="110"><template #default="{ row }">¥{{ money(row.avgTicket) }}</template></el-table-column>
        <el-table-column prop="refundCount" label="退款次数" width="110" />
        <el-table-column label="会员等级" width="120"><template #default="{ row }"><el-tag effect="plain">{{ level(row.totalSpent) }}</el-tag></template></el-table-column>
        <el-table-column label="最近消费" min-width="180"><template #default="{ row }">{{ row.lastOrderAt ? formatTime(row.lastOrderAt) : '暂无' }}</template></el-table-column>
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click.stop="openMember(row)">详情</el-button></template></el-table-column>
        <template #empty><el-empty description="没有符合条件的会员" /></template>
      </el-table>
      <div class="pagination"><el-pagination v-model:current-page="page" :page-size="20" layout="total, prev, pager, next" :total="total" @current-change="load" /></div>
    </article>
    <el-drawer v-model="drawer" title="会员详情" size="520px">
      <template v-if="selected">
        <div class="member-profile"><div class="member-avatar">{{ selected.nickname.slice(0, 1) }}</div><div><h2>{{ selected.nickname }}</h2><p>{{ selected.phone || '未绑定手机号' }} · {{ level(selected.totalSpent) }}</p></div></div>
        <section class="member-metrics"><div><span>累计消费</span><strong>¥{{ money(selected.totalSpent) }}</strong></div><div><span>订单</span><strong>{{ selected.orderCount }}</strong></div><div><span>客单价</span><strong>¥{{ money(selected.avgTicket) }}</strong></div></section>
        <div class="drawer-section"><h3>最近订单</h3><div v-for="order in selected.recentOrders" :key="order.id" class="member-order"><div><strong>{{ order.orderNo }}</strong><small>{{ formatTime(order.createdAt) }} · {{ order.items.map(i => `${i.productName}×${i.quantity}`).join('、') }}</small></div><span>¥{{ money(order.totalAmount) }}</span></div><el-empty v-if="!selected.recentOrders.length" description="暂无消费记录" /></div>
      </template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import { api } from "../api";
import type { MemberSummary } from "../types";
const loading = ref(false); const keyword = ref(""); const page = ref(1); const total = ref(0); const members = ref<MemberSummary[]>([]); const drawer = ref(false); const selected = ref<MemberSummary | null>(null);
function money(value: number) { return Number(value || 0).toFixed(2); }
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
function level(spent: number) { return spent >= 3000 ? "黑金" : spent >= 1000 ? "金卡" : spent >= 300 ? "银卡" : "新客"; }
async function load() { loading.value = true; try { const data = await api.members(keyword.value.trim(), page.value); members.value = data.list; total.value = data.total; } catch (e: any) { ElMessage.error(e.message || "会员加载失败"); } finally { loading.value = false; } }
function search() { page.value = 1; load(); }
function openMember(value: unknown) { selected.value = value as MemberSummary; drawer.value = true; }
onMounted(load);
</script>
