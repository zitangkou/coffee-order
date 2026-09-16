<template>
  <div class="tables-page">
    <div class="page-heading">
      <div>
        <h1>桌台与取餐码</h1>
        <p>管理堂食桌台、小程序桌码和打印状态</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="auth.isManager" :disabled="!selectedTables.length" :loading="batchGenerating" @click="generateSelected">批量生成桌码</el-button>
        <el-button :disabled="!codedTables.length" @click="printCodes"
          >打印已有桌码</el-button
        ><el-button v-if="auth.isManager" type="primary" @click="openTable()"
          >新增桌台</el-button
        >
      </div>
    </div>
    <section class="inventory-summary table-summary">
      <div>
        <strong>{{ tables.length }}</strong
        ><span>全部桌台</span>
      </div>
      <div>
        <strong>{{ activeTables.length }}</strong
        ><span>启用中</span>
      </div>
      <div>
        <strong>{{ codedTables.length }}</strong
        ><span>已生成桌码</span>
      </div>
      <div>
        <strong>{{ tables.length - codedTables.length }}</strong
        ><span>待生成</span>
      </div>
    </section>
    <article class="panel table-panel">
      <div class="table-notice">
        <div>
          <strong>小程序码生成说明</strong>
          <p>
            微信小程序认证及接口配置完成后可直接生成；当前缺少外部资质时，按钮会返回明确提示，不影响桌台维护。
          </p>
        </div>
        <el-button
          v-if="auth.isManager"
          plain
          :loading="takeoutLoading"
          @click="generateTakeout"
          >生成外带小程序码</el-button
        >
      </div>
      <el-table
        v-loading="loading"
        :data="tables"
        stripe
        height="calc(100vh - 390px)"
        @selection-change="selectedTables = $event"
      >
        <el-table-column v-if="auth.isManager" type="selection" width="48" />
        <el-table-column label="桌号" width="150"
          ><template #default="{ row }"
            ><strong class="table-number">{{ row.tableNo }}</strong></template
          ></el-table-column
        >
        <el-table-column label="桌码状态" min-width="220"
          ><template #default="{ row }"
            ><div v-if="row.qrCodeUrl" class="code-status">
              <img :src="assetUrl(row.qrCodeUrl)" alt="桌台码" />
              <div>
                <strong>已生成</strong
                ><small>{{ codeType(row.qrCodeUrl) }}</small>
              </div>
            </div>
            <span v-else class="muted-text">尚未生成</span></template
          ></el-table-column
        >
        <el-table-column label="启用状态" width="150"
          ><template #default="{ row }"
            ><el-switch
              :model-value="row.isActive"
              :disabled="!auth.isManager"
              :loading="switchingId === row.id"
              active-text="启用"
              inactive-text="停用"
              @change="toggleTable(row, $event)" /></template
        ></el-table-column>
        <el-table-column label="使用建议" min-width="220"
          ><template #default="{ row }"
            ><span>{{
              row.isActive ? "可放置于桌面供顾客扫码" : "已停用，请撤下桌码"
            }}</span></template
          ></el-table-column
        >
        <el-table-column label="操作" width="230" fixed="right"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              :loading="generatingId === row.id"
              @click="generateCode(row)"
              >{{ row.qrCodeUrl ? "重新生成" : "生成小程序码" }}</el-button
            ><el-button v-if="auth.isManager" link @click="openTable(row)"
              >编辑</el-button
            ><a v-if="row.qrCodeUrl" class="table-download" :href="assetUrl(row.qrCodeUrl)" :download="`coffee-table-${row.tableNo}.png`">下载</a
            ></template
          ></el-table-column
        >
        <template #empty><el-empty description="暂未创建桌台" /></template>
      </el-table>
    </article>

    <el-dialog
      v-model="tableDialog"
      :title="tableForm.id ? '编辑桌台' : '新增桌台'"
      width="430px"
    >
      <el-form label-position="top"
        ><el-form-item label="桌号"
          ><el-input
            v-model.trim="tableForm.tableNo"
            maxlength="20"
            placeholder="例如：A01、露台 1" /></el-form-item
        ><el-form-item v-if="tableForm.id" label="状态"
          ><el-switch
            v-model="tableForm.isActive"
            active-text="启用"
            inactive-text="停用" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="tableDialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveTable"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <div id="table-code-print" class="print-codes" aria-hidden="true">
      <div v-for="table in codedTables" :key="table.id" class="print-code-card">
        <div class="print-brand">NAGA COFFEE</div>
        <img :src="assetUrl(table.qrCodeUrl)" alt="" /><strong>{{
          table.tableNo
        }}</strong
        ><span>微信扫码点单</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";
import type { TableInfo } from "../types";

const auth = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const switchingId = ref<number>();
const generatingId = ref<number>();
const takeoutLoading = ref(false);
const batchGenerating = ref(false);
const tables = ref<TableInfo[]>([]);
const selectedTables = ref<TableInfo[]>([]);
const tableDialog = ref(false);
const tableForm = reactive({ id: 0, tableNo: "", isActive: true });
const activeTables = computed(() =>
  tables.value.filter((item) => item.isActive),
);
const codedTables = computed(() =>
  tables.value.filter((item) => item.qrCodeUrl),
);
function assetUrl(path?: string | null) {
  return path || "";
}
function codeType(path: string) {
  return path.includes("miniprogram-codes") ? "微信小程序码" : "网页二维码";
}
async function load() {
  loading.value = true;
  try {
    tables.value = await api.tables();
  } catch (error: any) {
    ElMessage.error(error.message || "桌台加载失败");
  } finally {
    loading.value = false;
  }
}
function openTable(value?: unknown) {
  const table = value as TableInfo | undefined;
  Object.assign(tableForm, {
    id: table?.id || 0,
    tableNo: table?.tableNo || "",
    isActive: table?.isActive !== false,
  });
  tableDialog.value = true;
}
async function saveTable() {
  if (!tableForm.tableNo) return ElMessage.warning("请输入桌号");
  saving.value = true;
  try {
    tableForm.id
      ? await api.updateTable(tableForm.id, {
          tableNo: tableForm.tableNo,
          isActive: tableForm.isActive,
        })
      : await api.createTable(tableForm.tableNo);
    ElMessage.success("桌台已保存");
    tableDialog.value = false;
    await load();
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
async function toggleTable(value: unknown, active: unknown) {
  if (!auth.isManager) return;
  const table = value as TableInfo;
  switchingId.value = table.id;
  try {
    await api.updateTable(table.id, { isActive: Boolean(active) });
    table.isActive = Boolean(active);
    ElMessage.success(table.isActive ? "桌台已启用" : "桌台已停用");
  } catch (error: any) {
    ElMessage.error(error.message || "状态更新失败");
  } finally {
    switchingId.value = undefined;
  }
}
async function generateCode(value: unknown) {
  const table = value as TableInfo;
  generatingId.value = table.id;
  try {
    const result = await api.generateTableCode(table.id);
    table.qrCodeUrl = result.qrUrl;
    ElMessage.success(`${table.tableNo} 小程序码已生成`);
  } catch (error: any) {
    ElMessage.error(error.message || "生成失败，请确认微信小程序接口配置");
  } finally {
    generatingId.value = undefined;
  }
}
async function generateTakeout() {
  takeoutLoading.value = true;
  try {
    await api.generateTakeoutCode();
    ElMessage.success("外带小程序码已生成，可在上传目录下载");
  } catch (error: any) {
    ElMessage.error(error.message || "生成失败，请确认微信小程序接口配置");
  } finally {
    takeoutLoading.value = false;
  }
}
async function generateSelected() {
  batchGenerating.value = true;
  try {
    const results = await api.generateTableCodes(selectedTables.value.map((item) => item.id));
    const failures = results.filter((item) => item.error);
    ElMessage[failures.length ? "warning" : "success"](
      failures.length ? `${results.length - failures.length} 个成功，${failures.length} 个失败` : `${results.length} 个桌码已生成`,
    );
    await load();
  } catch (error: any) {
    ElMessage.error(error.message || "批量生成失败");
  } finally {
    batchGenerating.value = false;
  }
}
function printCodes() {
  window.print();
}
onMounted(load);
</script>
