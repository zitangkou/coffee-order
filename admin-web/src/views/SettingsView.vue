<template>
  <div>
    <div class="page-heading">
      <div><h1>门店设置</h1><p>维护营业规则，并检查关键服务的运行状态</p></div>
      <el-button v-if="activeTab === 'store'" type="primary" :loading="saving" @click="save">保存设置</el-button>
      <el-button v-else :loading="statusLoading" @click="loadStatus">刷新状态</el-button>
    </div>
    <article class="panel settings-panel">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="营业设置" name="store">
          <el-form label-position="top" class="settings-form">
            <div class="form-grid two">
              <el-form-item label="门店名称"><el-input v-model.trim="form.name" maxlength="40" /></el-form-item>
              <el-form-item label="营业时间"><el-input v-model.trim="form.businessHours" placeholder="例如：08:00–20:00" /></el-form-item>
            </div>
            <el-form-item label="门店标语"><el-input v-model.trim="form.slogan" maxlength="80" /></el-form-item>
            <el-form-item label="顾客公告"><el-input v-model="form.announcement" type="textarea" :rows="3" maxlength="300" show-word-limit /></el-form-item>
            <div class="form-grid two">
              <el-form-item label="外带打包费"><el-input-number v-model="form.packFee" :min="0" :precision="2" :step="0.5" /></el-form-item>
            </div>
            <div class="setting-switches">
              <div><strong>接受新订单</strong><span>关闭后顾客端停止创建新订单</span><el-switch v-model="form.acceptOrders" /></div>
              <div><strong>堂食点单</strong><span>允许顾客通过桌码下单</span><el-switch v-model="form.dineInEnabled" /></div>
              <div><strong>外带点单</strong><span>允许顾客选择外带取餐</span><el-switch v-model="form.takeoutEnabled" /></div>
              <div><strong>顾客退款</strong><span>允许顾客提交退款申请</span><el-switch v-model="form.refundEnabled" /></div>
              <div><strong>外带手机号必填</strong><span>下单时用于取餐联系</span><el-switch v-model="form.takeoutPhoneRequired" /></div>
            </div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="系统状态" name="system">
          <div v-loading="statusLoading" class="system-status">
            <template v-if="system">
              <div class="status-card"><span>API / 数据库</span><strong :class="system.database ? 'ok' : 'danger'">{{ system.database ? '运行正常' : '连接异常' }}</strong><small>服务已运行 {{ duration(system.uptimeSeconds) }}</small></div>
              <div class="status-card"><span>磁盘空间</span><strong :class="(system.disk?.usedPercent || 0) >= 85 ? 'danger' : 'ok'">{{ system.disk ? `${system.disk.usedPercent}% 已使用` : '无法读取' }}</strong><small v-if="system.disk">剩余 {{ bytes(system.disk.freeBytes) }}</small></div>
              <div class="status-card"><span>最近备份</span><strong :class="system.latestBackupAt ? 'ok' : 'warning'">{{ system.latestBackupAt ? formatTime(system.latestBackupAt) : '未发现备份' }}</strong><small>检查服务端备份目录</small></div>
              <div class="status-card"><span>打印服务</span><strong :class="system.printerEnabled ? 'ok' : 'warning'">{{ system.printerEnabled ? '已启用' : '未启用' }}</strong><el-button size="small" plain @click="testPrinter">发送测试打印</el-button></div>
              <div class="readiness-card">
                <div><strong>微信能力就绪度</strong><span>不会展示任何密钥或证书内容</span></div>
                <el-tag v-for="(ready, name) in system.wechat" :key="name" :type="ready ? 'success' : 'info'">{{ readinessName(name) }}：{{ ready ? '就绪' : '未配置' }}</el-tag>
              </div>
              <p class="status-checked">检查时间：{{ formatTime(system.checkedAt) }} · {{ system.environment }}</p>
            </template>
            <el-empty v-else description="尚未获取系统状态" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import "element-plus/es/components/message/style/css";
import { api } from "../api";
import type { ShopSetting, SystemStatus } from "../types";

const activeTab = ref("store");
const saving = ref(false);
const statusLoading = ref(false);
const system = ref<SystemStatus | null>(null);
const form = reactive<ShopSetting>({ name: "Coffee OS", slogan: "", announcement: "", businessHours: "", acceptOrders: true, dineInEnabled: true, takeoutEnabled: true, packFee: 0, refundEnabled: true, takeoutPhoneRequired: false });
async function loadSettings() {
  try { const value = await api.settings(); if (value) Object.assign(form, value, { packFee: Number(value.packFee) }); } catch (e: any) { ElMessage.error(e.message || "门店设置加载失败"); }
}
async function save() {
  if (!form.name.trim()) return ElMessage.warning("请输入门店名称");
  saving.value = true;
  try { Object.assign(form, await api.updateSettings(form)); ElMessage.success("门店设置已保存"); } catch (e: any) { ElMessage.error(e.message || "保存失败"); } finally { saving.value = false; }
}
async function loadStatus() {
  statusLoading.value = true;
  try { system.value = await api.systemStatus(); } catch (e: any) { ElMessage.error(e.message || "系统状态加载失败"); } finally { statusLoading.value = false; }
}
async function testPrinter() {
  try { await api.testPrinter(); ElMessage.success("测试打印任务已发送"); } catch (e: any) { ElMessage.error(e.message || "测试打印失败"); }
}
function bytes(value: number) { const units = ["B", "KB", "MB", "GB", "TB"]; let size = value; let index = 0; while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; } return `${size.toFixed(index > 1 ? 1 : 0)} ${units[index]}`; }
function duration(seconds: number) { const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); return days ? `${days} 天 ${hours} 小时` : `${hours} 小时`; }
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
function readinessName(name: string) { return ({ miniProgramLogin: "小程序登录", paymentRequest: "支付下单", paymentCallback: "支付回调", refundFlow: "退款流程", subscribeMessage: "订阅消息" } as Record<string, string>)[name] || name; }
watch(activeTab, (value) => { if (value === "system" && !system.value) loadStatus(); });
onMounted(loadSettings);
</script>
