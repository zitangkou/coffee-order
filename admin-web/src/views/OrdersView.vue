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
          v-model="keyword"
          clearable
          placeholder="搜索订单号或取餐码"
          class="order-search"
        />
      </div>
      <template v-if="status !== 'REFUNDS'">
        <el-table
          v-loading="loading"
          :data="filteredOrders"
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
          <el-table-column v-if="auth.isManager" label="操作" width="170"
            ><template #default="{ row }"
              ><template v-if="row.status === 'PENDING'"
                ><el-button type="primary" link @click="approveRefund(row)"
                  >同意退款</el-button
                ><el-button type="danger" link @click="rejectRefund(row)"
                  >拒绝</el-button
                ></template
              ></template
            ></el-table-column
          >
        </el-table>
      </template>
    </article>

    <el-drawer v-model="drawer" title="订单详情" size="520px">
      <template v-if="selected"
        ><div class="drawer-status">
          <StatusBadge :status="selected.status" /><strong>{{
            selected.pickupNo
          }}</strong
          ><span>取餐码</span>
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
        </div></template
      >
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge.vue";
import { useAuthStore } from "../stores/auth";
import type { Order } from "../types";

const route = useRoute();
const auth = useAuthStore();
const loading = ref(false);
const status = ref(String(route.query.status || "PAID"));
const keyword = ref("");
const orders = ref<Order[]>([]);
const refunds = ref<any[]>([]);
const page = ref(1);
const total = ref(0);
const drawer = ref(false);
const selected = ref<Order | null>(null);
let timer: number | undefined;
const statusOptions = [
  { label: "待接单", value: "PAID" },
  { label: "制作中", value: "MAKING" },
  { label: "待取餐", value: "READY" },
  { label: "已完成", value: "COMPLETED" },
  { label: "退款", value: "REFUNDS" },
];
const filteredOrders = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return q
    ? orders.value.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.pickupNo.toLowerCase().includes(q),
      )
    : orders.value;
});
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
function openDetails(value: unknown) {
  selected.value = value as Order;
  drawer.value = true;
}
async function load() {
  loading.value = true;
  try {
    if (status.value === "REFUNDS") refunds.value = await api.refunds();
    else {
      const data = await api.orders(status.value, page.value);
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
async function advance(value: unknown) {
  const order = value as Order;
  const action = nextAction(order.status);
  if (!action) return;
  try {
    await api.updateOrderStatus(order.id, action.status);
    ElMessage.success(`订单已${action.label}`);
    load();
  } catch (e: any) {
    ElMessage.error(e.message || "操作失败");
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
onMounted(() => {
  load();
  timer = window.setInterval(load, 10000);
});
onBeforeUnmount(() => window.clearInterval(timer));
</script>
