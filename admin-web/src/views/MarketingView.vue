<template>
  <div>
    <div class="page-heading"><div><h1>营销运营</h1><p>活动优惠由服务端统一计算，自动选择当前最优优惠</p></div><el-button type="primary" @click="openPromotion()">新建活动</el-button></div>
    <section class="marketing-note"><strong>已覆盖的运营入口</strong><span>门店公告在“门店设置”维护；首页推荐通过商品的“招牌推荐 / 热销商品”维护。</span></section>
    <article class="panel">
      <el-table v-loading="loading" :data="promotions" stripe>
        <el-table-column prop="name" label="活动名称" min-width="180" />
        <el-table-column label="类型" width="130"><template #default="{ row }">{{ typeName(row.type) }}</template></el-table-column>
        <el-table-column label="优惠规则" min-width="220"><template #default="{ row }">{{ ruleText(row) }}</template></el-table-column>
        <el-table-column label="活动时间" min-width="250"><template #default="{ row }">{{ row.startsAt ? formatTime(row.startsAt) : '立即开始' }} — {{ row.endsAt ? formatTime(row.endsAt) : '长期有效' }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '启用' : '停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="150"><template #default="{ row }"><el-button link type="primary" @click="openPromotion(row)">编辑</el-button><el-button link type="danger" @click="remove(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="暂未创建营销活动" /></template>
      </el-table>
    </article>
    <el-dialog v-model="dialog" :title="form.id ? '编辑活动' : '新建活动'" width="600px">
      <el-form label-position="top">
        <div class="form-grid two"><el-form-item label="活动名称"><el-input v-model.trim="form.name" maxlength="50" /></el-form-item><el-form-item label="活动类型"><el-select v-model="form.type"><el-option label="满减" value="FULL_REDUCTION" /><el-option label="全场折扣" value="PERCENT" /><el-option label="新客优惠" value="NEW_CUSTOMER" /><el-option label="会员日" value="MEMBER_DAY" /></el-select></el-form-item></div>
        <div v-if="form.type === 'FULL_REDUCTION'" class="form-grid two"><el-form-item label="消费满"><el-input-number v-model="form.threshold" :min="0.01" :precision="2" /></el-form-item><el-form-item label="立减"><el-input-number v-model="form.reduction" :min="0.01" :precision="2" /></el-form-item></div>
        <el-form-item v-else-if="form.type === 'NEW_CUSTOMER'" label="新客立减"><el-input-number v-model="form.reduction" :min="0.01" :precision="2" /></el-form-item>
        <el-form-item v-else label="折扣"><el-input-number v-model="form.discount" :min="1" :max="9.9" :precision="1" /><span class="field-hint">例如 8.8 表示八八折</span></el-form-item>
        <el-form-item v-if="form.type === 'MEMBER_DAY'" label="会员日"><el-checkbox-group v-model="form.weekdays"><el-checkbox v-for="(day, index) in weekdays" :key="index" :value="index + 1">{{ day }}</el-checkbox></el-checkbox-group></el-form-item>
        <el-form-item label="活动时间"><el-date-picker v-model="form.dateRange" type="datetimerange" start-placeholder="开始时间（可选）" end-placeholder="结束时间（可选）" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存活动</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import { api } from "../api";
import type { Promotion } from "../types";
const loading = ref(false); const saving = ref(false); const dialog = ref(false); const promotions = ref<Promotion[]>([]); const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const form = reactive({ id: 0, name: "", type: "FULL_REDUCTION" as Promotion["type"], threshold: 50, reduction: 5, discount: 8.8, weekdays: [1] as number[], dateRange: null as [Date, Date] | null, isActive: true });
async function load() { loading.value = true; try { promotions.value = await api.promotions(); } catch (e: any) { ElMessage.error(e.message || "活动加载失败"); } finally { loading.value = false; } }
function typeName(type: string) { return ({ FULL_REDUCTION: "满减", PERCENT: "全场折扣", NEW_CUSTOMER: "新客优惠", MEMBER_DAY: "会员日" } as Record<string, string>)[type] || type; }
function ruleText(value: unknown) { const row = value as Promotion; if (row.type === "FULL_REDUCTION") return `满 ¥${row.config.threshold} 减 ¥${row.config.reduction}`; if (row.type === "NEW_CUSTOMER") return `首单立减 ¥${row.config.reduction}`; const text = `${Number(row.config.rate || 1) * 10} 折`; return row.type === "MEMBER_DAY" ? `${(row.config.weekdays || []).map(i => weekdays[i - 1]).join('、')} ${text}` : text; }
function formatTime(value: string) { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
function openPromotion(value?: unknown) { const row = value as Promotion | undefined; Object.assign(form, { id: row?.id || 0, name: row?.name || "", type: row?.type || "FULL_REDUCTION", threshold: Number(row?.config.threshold || 50), reduction: Number(row?.config.reduction || 5), discount: Number(row?.config.rate || 0.88) * 10, weekdays: [...(row?.config.weekdays || [1])], dateRange: row?.startsAt && row?.endsAt ? [new Date(row.startsAt), new Date(row.endsAt)] : null, isActive: row?.isActive !== false }); dialog.value = true; }
async function save() { if (!form.name) return ElMessage.warning("请输入活动名称"); const config = form.type === "FULL_REDUCTION" ? { threshold: form.threshold, reduction: form.reduction } : form.type === "NEW_CUSTOMER" ? { reduction: form.reduction } : { rate: form.discount / 10, ...(form.type === "MEMBER_DAY" ? { weekdays: form.weekdays } : {}) }; const payload = { name: form.name, type: form.type, config, startsAt: form.dateRange?.[0].toISOString() || null, endsAt: form.dateRange?.[1].toISOString() || null, isActive: form.isActive }; saving.value = true; try { form.id ? await api.updatePromotion(form.id, payload) : await api.createPromotion(payload); ElMessage.success("营销活动已保存"); dialog.value = false; await load(); } catch (e: any) { ElMessage.error(e.message || "保存失败"); } finally { saving.value = false; } }
async function remove(value: unknown) { const row = value as Promotion; try { await ElMessageBox.confirm(`确认删除“${row.name}”？`, "删除活动", { type: "warning" }); await api.deletePromotion(row.id); ElMessage.success("活动已删除"); await load(); } catch (e: any) { if (e !== "cancel" && e !== "close") ElMessage.error(e.message || "删除失败"); } }
onMounted(load);
</script>
