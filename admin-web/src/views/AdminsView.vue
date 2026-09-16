<template>
  <div>
    <div class="page-heading">
      <div><h1>员工与权限</h1><p>维护后台账号，并查看关键操作审计记录</p></div>
      <el-button type="primary" @click="openCreate">新增员工</el-button>
    </div>
    <article class="panel admin-management-panel">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="员工账号" name="accounts">
          <el-table v-loading="loading" :data="admins" stripe>
            <el-table-column prop="username" label="账号" min-width="180" />
            <el-table-column label="角色" width="130"><template #default="{ row }">{{ row.role === 'MANAGER' ? '店长' : '店员' }}</template></el-table-column>
            <el-table-column label="状态" width="130"><template #default="{ row }"><el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag></template></el-table-column>
            <el-table-column label="创建时间" min-width="190"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="190"><template #default="{ row }">
              <span v-if="row.id === auth.admin?.id" class="muted-text">当前账号</span>
              <template v-else>
                <el-button link type="primary" @click="editRole(row)">修改角色</el-button>
                <el-button link :type="row.status === 'ACTIVE' ? 'danger' : 'success'" @click="toggleAdmin(row)">{{ row.status === 'ACTIVE' ? '停用' : '启用' }}</el-button>
              </template>
            </template></el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="操作日志" name="logs">
          <div class="tab-actions"><p>展示最近 100 条关键后台操作。</p><el-button @click="loadLogs">刷新日志</el-button></div>
          <el-table v-loading="logsLoading" :data="logs" stripe>
            <el-table-column label="时间" width="190"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作人" width="130"><template #default="{ row }">{{ row.admin?.username || '-' }}</template></el-table-column>
            <el-table-column prop="action" label="动作" min-width="170" />
            <el-table-column label="对象" min-width="170"><template #default="{ row }">{{ row.targetType }}<span v-if="row.targetId"> #{{ row.targetId }}</span></template></el-table-column>
            <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </article>
    <el-dialog v-model="createDialog" title="新增员工账号" width="440px">
      <el-form label-position="top">
        <el-form-item label="登录账号"><el-input v-model.trim="form.username" maxlength="30" /></el-form-item>
        <el-form-item label="初始密码"><el-input v-model="form.password" type="password" show-password placeholder="至少 8 位；首次登录必须修改" /></el-form-item>
        <el-form-item label="角色"><el-radio-group v-model="form.role"><el-radio-button value="STAFF">店员</el-radio-button><el-radio-button value="MANAGER">店长</el-radio-button></el-radio-group></el-form-item>
      </el-form>
      <template #footer><el-button @click="createDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="createAdmin">创建账号</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";
import type { AdminRecord, AuditLog } from "../types";

const auth = useAuthStore();
const activeTab = ref("accounts");
const loading = ref(false);
const logsLoading = ref(false);
const saving = ref(false);
const admins = ref<AdminRecord[]>([]);
const logs = ref<AuditLog[]>([]);
const createDialog = ref(false);
const form = reactive({ username: "", password: "", role: "STAFF" });
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
async function loadAdmins() {
  loading.value = true;
  try { admins.value = await api.admins(); } catch (e: any) { ElMessage.error(e.message || "员工加载失败"); } finally { loading.value = false; }
}
async function loadLogs() {
  logsLoading.value = true;
  try { logs.value = await api.auditLogs(); } catch (e: any) { ElMessage.error(e.message || "日志加载失败"); } finally { logsLoading.value = false; }
}
function openCreate() { Object.assign(form, { username: "", password: "", role: "STAFF" }); createDialog.value = true; }
async function createAdmin() {
  if (!form.username) return ElMessage.warning("请输入登录账号");
  if (form.password.length < 8) return ElMessage.warning("初始密码至少 8 位");
  saving.value = true;
  try { await api.createAdmin(form); ElMessage.success("员工账号已创建"); createDialog.value = false; await loadAdmins(); } catch (e: any) { ElMessage.error(e.message || "创建失败"); } finally { saving.value = false; }
}
async function editRole(value: unknown) {
  const row = value as AdminRecord;
  const next = row.role === "MANAGER" ? "STAFF" : "MANAGER";
  try {
    await ElMessageBox.confirm(`确认将“${row.username}”调整为${next === 'MANAGER' ? '店长' : '店员'}？`, "修改角色", { type: "warning" });
    await api.updateAdmin(row.id, { role: next }); ElMessage.success("角色已更新"); await loadAdmins();
  } catch (e: any) { if (e !== "cancel" && e !== "close") ElMessage.error(e.message || "更新失败"); }
}
async function toggleAdmin(value: unknown) {
  const row = value as AdminRecord;
  const disabling = row.status === "ACTIVE";
  try {
    if (disabling) await ElMessageBox.confirm(`停用后“${row.username}”的现有登录将失效。`, "停用账号", { type: "warning" });
    await api.updateAdmin(row.id, { status: disabling ? "DISABLED" : "ACTIVE" }); ElMessage.success(disabling ? "账号已停用" : "账号已启用"); await loadAdmins();
  } catch (e: any) { if (e !== "cancel" && e !== "close") ElMessage.error(e.message || "更新失败"); }
}
watch(activeTab, (value) => { if (value === "logs" && !logs.value.length) loadLogs(); });
onMounted(loadAdmins);
</script>
