<template>
  <div class="orders-page">
    <div class="page-heading">
      <div>
        <h1>订单工作台</h1>
        <p>处理接单、制作、取餐与退款状态</p>
      </div>
      <div class="heading-actions">
        <span class="auto-refresh"><i />自动刷新</span
        ><el-button @click="load">立即刷新</el-button>
      </div>
    </div>
    <article class="panel order-panel">
      <div class="order-toolbar">
        <el-segmented
          v-model="status"
          :options="statusOptions"
          @change="changeStatus"
        />
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="订单号、取餐码、手机后四位"
          class="order-search"
          @keyup.enter="applyFilters"
        />
      </div>
      <div v-if="status !== 'REFUNDS'" class="order-filters">
        <el-select v-model="filters.orderType" clearable placeholder="全部用餐方式">
          <el-option label="堂食" value="DINE_IN" />
          <el-option label="外带" value="TAKEOUT" />
        </el-select>
        <el-select v-model="filters.tableId" clearable placeholder="全部桌台">
          <el-option v-for="table in tables" :key="table.id" :label="table.tableNo" :value="table.id" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          range-separator="至"
        />
        <el-button type="primary" @click="applyFilters">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
      <template v-if="status !== 'REFUNDS'">
        <el-table
          v-loading="loading"
          :data="orders"
          height="calc(100vh - 300px)"
          stripe
          @row-click="openDetails"
        >
          <el-table-column label="订单" min-width="190"
            ><template #default="{ row }"
              ><div class="order-number">{{ row.orderNo }}</div>
              <small>{{ formatTime(row.createdAt) }}</small></template
            ></el-table-column
          >
          <el-table-column label="取餐码" width="105"
            ><template #default="{ row }"
              ><strong class="pickup-number">{{
                row.pickupNo
              }}</strong></template
            ></el-table-column
          >
          <el-table-column label="类型" width="115"
            ><template #default="{ row }">{{
              row.orderType === "DINE_IN"
                ? `堂食 · ${row.table?.tableNo || "-"}`
                : "外带"
            }}</template></el-table-column
          >
          <el-table-column label="商品" min-width="220"
            ><template #default="{ row }"
              ><div v-for="item in row.items.slice(0, 2)" :key="item.id">
                {{ item.productName }} ×{{ item.quantity }}
              </div>
              <small v-if="row.items.length > 2"
                >另有 {{ row.items.length - 2 }} 项</small
              ></template
            ></el-table-column
          >
          <el-table-column label="金额" width="100"
            ><template #default="{ row }"
              ><strong>¥{{ money(row.totalAmount) }}</strong></template
            ></el-table-column
          >
          <el-table-column label="状态" width="120"
            ><template #default="{ row }"
              ><StatusBadge :status="row.status" /></template
          ></el-table-column>
          <el-table-column label="操作" width="120" fixed="right"
            ><template #default="{ row }"
              ><el-button
                v-if="nextAction(row.status)"
                type="primary"
                link
                @click.stop="advance(row)"
                >{{ nextAction(row.status)?.label }}</el-button
              ><el-button link @click.stop="openDetails(row)"
                >详情</el-button
              ></template
            ></el-table-column
          >
          <template #empty><el-empty description="当前没有订单" /></template>
        </el-table>
        <div class="pagination">
          <el-pagination
            v-model:current-page="page"
            :page-size="20"
            layout="total, prev, pager, next"
            :total="total"
            @current-change="load"
          />
        </div>
      </template>
      <template v-else>
        <el-table
          v-loading="loading"
          :data="refunds"
          height="calc(100vh - 260px)"
          stripe
        >
          <el-table-column prop="id" label="退款编号" width="100" />
          <el-table-column label="订单号" min-width="190"
            ><template #default="{ row }">{{
              row.order?.orderNo
            }}</template></el-table-column
          >
          <el-table-column prop="reason" label="申请原因" min-width="180" />
          <el-table-column label="金额" width="100"
            ><template #default="{ row }"
              >¥{{ money(row.order?.totalAmount) }}</template
            ></el-table-column
          >
          <el-table-column label="状态" width="140"
            ><template #default="{ row }">{{
              refundText(row.status)
            }}</template></el-table-column
          >
          <el-table-column v-if="auth.isManager" label="操作" width="220">
            <template #default="{ row }">
              <template v-if="row.status === 'PENDING'">
                <el-button type="primary" link @click="approveRefund(row)">同意退款</el-button>
                <el-button type="danger" link @click="rejectRefund(row)">拒绝</el-button>
              </template>
              <el-button
                v-if="['PROCESSING', 'FAILED'].includes(row.status)"
                link
                type="primary"
                :loading="syncingRefundId === row.id"
                @click="syncRefund(row)"
              >同步状态</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </article>

    <el-drawer v-model="drawer" title="订单详情" size="560px">
      <template v-if="selected"
        ><div class="drawer-status">
          <StatusBadge :status="selected.status" /><strong>{{
            selected.pickupNo
          }}</strong
          ><span>取餐码</span>
        </div>
        <div class="drawer-actions">
          <el-button :loading="printing" @click="reprintSelected">重新打印</el-button>
          <el-button v-if="nextAction(selected.status)" type="primary" @click="advance(selected)">
            {{ nextAction(selected.status)?.label }}
          </el-button>
        </div>
        <el-descriptions :column="1" border
          ><el-descriptions-item label="订单号">{{
            selected.orderNo
          }}</el-descriptions-item
          ><el-descriptions-item label="下单时间">{{
            formatTime(selected.createdAt)
          }}</el-descriptions-item
          ><el-descriptions-item label="用餐方式">{{
            selected.orderType === "DINE_IN"
              ? `堂食 · ${selected.table?.tableNo || "-"}`
              : "外带"
          }}</el-descriptions-item
          ><el-descriptions-item v-if="selected.remark" label="备注">{{
            selected.remark
          }}</el-descriptions-item></el-descriptions
        >
        <div class="drawer-section">
          <h3>商品明细</h3>
          <div
            v-for="item in selected.items"
            :key="item.id"
            class="drawer-item"
          >
            <div>
              <strong>{{ item.productName }} ×{{ item.quantity }}</strong
              ><small>{{ specs(item.specsDetail) }}</small>
            </div>
            <span>¥{{ money(item.subtotal) }}</span>
          </div>
          <div class="drawer-total">
            <span>订单合计</span
            ><strong>¥{{ money(selected.totalAmount) }}</strong>
          </div>
        </div>
        <div class="drawer-section">
          <h3>支付与退款时间线</h3>
          <el-timeline>
            <template v-if="selected.statusLogs?.length">
              <el-timeline-item
                v-for="log in selected.statusLogs"
                :key="`status-${log.id}`"
                :timestamp="formatTime(log.createdAt)"
                type="primary"
              >订单状态：{{ statusText(log.status) }} · {{ sourceText(log.source) }}</el-timeline-item>
            </template>
            <el-timeline-item v-else :timestamp="formatTime(selected.createdAt)" type="primary">订单创建</el-timeline-item>
            <el-timeline-item
              v-for="payment in selected.payments || []"
              :key="`payment-${payment.id}`"
              :timestamp="formatTime(payment.createdAt)"
              :type="payment.status === 'SUCCESS' ? 'success' : 'warning'"
            >
              {{ payment.channel }} 支付 {{ payment.status }} · ¥{{ money(payment.amount) }}
            </el-timeline-item>
            <el-timeline-item
              v-for="refund in selected.refunds || []"
              :key="`refund-${refund.id}`"
              :timestamp="formatTime(refund.updatedAt || refund.createdAt)"
              :type="refund.status === 'SUCCESS' ? 'success' : refund.status === 'FAILED' ? 'danger' : 'warning'"
            >
              退款 {{ refundText(refund.status) }} · ¥{{ money(refund.refundAmount ?? selected.totalAmount) }}
              <small v-if="refund.failureReason || refund.rejectReason">{{ refund.failureReason || refund.rejectReason }}</small>
            </el-timeline-item>
            <el-timeline-item
              v-for="audit in selected.auditLogs || []"
              :key="`audit-${audit.id}`"
              :timestamp="formatTime(audit.createdAt)"
            >后台操作：{{ audit.action }} · {{ audit.admin?.username || '系统' }}<small v-if="audit.detail">{{ audit.detail }}</small></el-timeline-item>
            <el-timeline-item :timestamp="formatTime(selected.updatedAt || selected.createdAt)">
              当前状态：{{ selected.status }}
            </el-timeline-item>
          </el-timeline>
        </div></template
      >
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.vue";
import { useAuthStore } from "../stores/auth";
import type { Order, TableInfo } from "../types";

const route = useRoute();
const auth = useAuthStore();
const loading = ref(false);
const status = ref(String(route.query.status || "PAID"));
const orders = ref<Order[]>([]);
const refunds = ref<any[]>([]);
const tables = ref<TableInfo[]>([]);
const filters = reactive<{
  keyword: string;
  orderType: string;
  tableId?: number;
  dateRange: [Date, Date] | null;
}>({ keyword: "", orderType: "", tableId: undefined, dateRange: null });
const page = ref(1);
const total = ref(0);
const drawer = ref(false);
const selected = ref<Order | null>(null);
const syncingRefundId = ref<number>();
const printing = ref(false);
let timer: number | undefined;
const statusOptions = [
  { label: "待接单", value: "PAID" },
  { label: "制作中", value: "MAKING" },
  { label: "待取餐", value: "READY" },
  { label: "已完成", value: "COMPLETED" },
  { label: "退款", value: "REFUNDS" },
];
function money(v: any) {
  return Number(v || 0).toFixed(2);
}
function formatTime(v: string) {
  return new Date(v).toLocaleString("zh-CN", { hour12: false });
}
function specs(v: Record<string, string | string[]>) {
  return (
    Object.values(v || {})
      .flat()
      .join(" / ") || "标准"
  );
}
function nextAction(s: string) {
  return (
    {
      PAID: { label: "接单", status: "MAKING" },
      MAKING: { label: "出餐", status: "READY" },
      READY: { label: "完成", status: "COMPLETED" },
    } as Record<string, { label: string; status: string }>
  )[s];
}
async function openDetails(value: unknown) {
  const order = value as Order;
  selected.value = order;
  drawer.value = true;
  try {
    selected.value = await api.order(order.id);
  } catch (e: any) {
    ElMessage.error(e.message || "订单详情加载失败");
  }
}
async function load() {
  loading.value = true;
  try {
    if (status.value === "REFUNDS") refunds.value = await api.refunds();
    else {
      const data = await api.orders({
        status: status.value,
        keyword: filters.keyword.trim(),
        orderType: filters.orderType,
        tableId: filters.tableId,
        startAt: filters.dateRange?.[0].toISOString(),
        endAt: filters.dateRange?.[1].toISOString(),
        page: page.value,
        pageSize: 20,
      });
      orders.value = data.list;
      total.value = data.total;
    }
  } catch (e: any) {
    ElMessage.error(e.message || "订单加载失败");
  } finally {
    loading.value = false;
  }
}
function changeStatus() {
  page.value = 1;
  load();
}
function applyFilters() {
  page.value = 1;
  load();
}
function resetFilters() {
  Object.assign(filters, { keyword: "", orderType: "", tableId: undefined, dateRange: null });
  applyFilters();
}
async function advance(value: unknown) {
  const order = value as Order;
  const action = nextAction(order.status);
  if (!action) return;
  try {
    await api.updateOrderStatus(order.id, action.status);
    ElMessage.success(`订单已${action.label}`);
    await load();
    if (drawer.value) selected.value = await api.order(order.id);
  } catch (e: any) {
    ElMessage.error(e.message || "操作失败");
  }
}
async function syncRefund(row: any) {
  syncingRefundId.value = row.id;
  try {
    await api.syncRefund(row.id);
    ElMessage.success("退款状态已同步");
    await load();
  } catch (e: any) {
    ElMessage.error(e.message || "退款状态同步失败");
  } finally {
    syncingRefundId.value = undefined;
  }
}
async function reprintSelected() {
  if (!selected.value) return;
  printing.value = true;
  try {
    await api.reprintOrder(selected.value.id);
    ElMessage.success("打印任务已提交");
  } catch (e: any) {
    ElMessage.error(e.message || "重新打印失败");
  } finally {
    printing.value = false;
  }
}
async function approveRefund(row: any) {
  try {
    await ElMessageBox.confirm(
      `确认原路退回 ¥${money(row.order?.totalAmount)}？`,
      `退款 #${row.id}`,
      { type: "warning", confirmButtonText: "确认退款" },
    );
    await api.handleRefund(row.id, "approved");
    ElMessage.success("退款已提交");
    load();
  } catch (e: any) {
    if (e !== "cancel" && e !== "close")
      ElMessage.error(e.message || "退款失败");
  }
}
async function rejectRefund(row: any) {
  try {
    const result = await ElMessageBox.prompt(
      "请输入拒绝原因",
      `拒绝退款 #${row.id}`,
      {
        inputValidator: (v) => Boolean(v.trim()) || "请输入原因",
        confirmButtonText: "确认拒绝",
      },
    );
    await api.handleRefund(row.id, "rejected", result.value);
    ElMessage.success("已拒绝退款");
    load();
  } catch (e: any) {
    if (e !== "cancel" && e !== "close")
      ElMessage.error(e.message || "操作失败");
  }
}
function refundText(s: string) {
  return (
    (
      {
        PENDING: "待审核",
        PROCESSING: "退款处理中",
        SUCCESS: "退款成功",
        FAILED: "退款异常",
        REJECTED: "已拒绝",
        APPROVED: "历史已同意",
      } as Record<string, string>
    )[s] || s
  );
}
function statusText(status: string) {
  return ({ UNPAID: "待支付", PAID: "待接单", MAKING: "制作中", READY: "待取餐", COMPLETED: "已完成", REFUNDING: "退款中", REFUNDED: "已退款", CANCELLED: "已取消" } as Record<string, string>)[status] || status;
}
function sourceText(source: string) {
  return ({ CUSTOMER: "顾客操作", ADMIN: "后台操作", WECHAT: "微信支付", MOCK: "模拟支付", SYSTEM: "系统", MIGRATION: "历史记录" } as Record<string, string>)[source] || source;
}
onMounted(() => {
  api.tables().then((value) => (tables.value = value)).catch(() => undefined);
  load();
  timer = window.setInterval(load, 10000);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>
