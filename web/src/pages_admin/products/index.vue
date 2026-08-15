<template>
  <view class="page">
    <view class="card filter-row">
      <input v-model="filters.keyword" class="f-input search" placeholder="搜索名称/英文名/风味" @confirm="loadProducts" />
      <view class="filter-actions">
        <picker :range="cats" range-key="name" @change="onCatChange">
          <view class="mini-btn">{{ catName(filters.categoryId) }}</view>
        </picker>
        <picker :range="statusOptions" range-key="label" @change="onStatusChange">
          <view class="mini-btn">{{ statusOptions.find(s => s.value === filters.status)?.label || "全部状态" }}</view>
        </picker>
        <view class="mini-btn primary" @tap="loadProducts">查询</view>
      </view>
    </view>

    <view class="card" v-for="p in products" :key="p.id">
      <image v-if="p.imageUrl" :src="imgUrl(p.imageUrl)" mode="aspectFill" class="p-img" />
      <view class="p-top">
        <view class="p-name">
          {{ p.name }}
          <text class="tag tag-light">{{ catName(p.categoryId) }}</text>
        </view>
        <text class="price">¥{{ p.price }}</text>
      </view>
      <view class="p-tags">
        <text class="badge" :class="p.isSoldOut ? 'badge-danger' : p.isActive ? 'badge-success' : 'badge-grey'">
          {{ p.isSoldOut ? "售罄" : p.isActive ? "在售" : "已下架" }}
        </text>
        <text v-if="p.isSignature" class="badge badge-accent">招牌</text>
        <text v-if="p.isHot" class="badge badge-warning">热销</text>
        <text v-if="p.specGroups.length" class="text-sub">{{ p.specGroups.length }} 组规格</text>
        <text v-if="p.flavorNotes" class="text-sub">{{ p.flavorNotes }}</text>
      </view>
      <view class="p-actions">
        <view class="mini-btn" @tap="uploadImage(p)">传图</view>
        <view class="mini-btn" @tap="openEdit(p)">编辑</view>
        <view class="mini-btn" @tap="toggleSoldOut(p)">{{ p.isSoldOut ? "恢复在售" : "标记售罄" }}</view>
        <view class="mini-btn" @tap="toggleActive(p)">{{ p.isActive ? "下架" : "上架" }}</view>
        <view class="mini-btn danger" @tap="remove(p)">删除</view>
      </view>
    </view>

    <view v-if="!products.length" class="empty">没有匹配的商品</view>
    <view class="add-bar btn-primary" @tap="openCreate">＋ 新增商品</view>

    <!-- 商品编辑弹层 -->
    <view v-if="showForm" class="mask" @tap="closeForm">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">{{ form.id ? "编辑商品" : "新增商品" }}</view>
        <scroll-view scroll-y class="form-scroll">
          <view class="f-label">名称</view>
          <input v-model="form.name" class="f-input" placeholder="商品名称" />
          <view class="f-label">英文名</view>
          <input v-model="form.nameEn" class="f-input" placeholder="选填" />
          <view class="f-label">分类</view>
          <picker :range="cats" range-key="name" @change="onFormCatChange">
            <view class="f-input">{{ catName(form.categoryId) || "请选择分类" }}</view>
          </picker>
          <view class="f-label">价格</view>
          <input v-model="form.price" class="f-input" type="digit" placeholder="基础价格" />
          <view class="f-label">风味描述</view>
          <input v-model="form.flavorNotes" class="f-input" placeholder="如：坚果 / 黑巧" />
          <view class="f-label">烘焙度</view>
          <input v-model="form.roastLevel" class="f-input" placeholder="浅烘/中烘/深烘" />
          <view class="f-label">产区/豆种</view>
          <input v-model="form.origin" class="f-input" placeholder="选填" />
          <view class="f-label">描述</view>
          <textarea v-model="form.description" class="f-textarea" placeholder="商品描述" />

          <view class="switch-row">
            <text>招牌商品</text>
            <switch :checked="form.isSignature" color="#2F2A26" @change="(e:any)=>form.isSignature=e.detail.value" />
          </view>
          <view class="switch-row">
            <text>热销商品</text>
            <switch :checked="form.isHot" color="#2F2A26" @change="(e:any)=>form.isHot=e.detail.value" />
          </view>

          <view class="f-label section">规格配置（勾选要启用的规格组）</view>
          <view v-for="g in specGroups" :key="g.id" class="spec-template">
            <view class="st-top">
              <label class="st-check">
                <checkbox :checked="!!form.specEnabled[g.id]" color="#2F2A26" @click="toggleSpec(g.id)" />
                <text class="st-name">{{ g.name }}</text>
                <text class="st-type">{{ g.type === "MULTI" ? "多选" : "单选" }}</text>
              </label>
              <view v-if="form.specEnabled[g.id]" class="st-required">
                <text>必选</text>
                <switch :checked="form.specRequired[g.id] !== false" color="#2F2A26" style="transform: scale(0.7)" @change="(e:any)=>form.specRequired[g.id]=e.detail.value" />
              </view>
            </view>
            <view class="st-options">
              <text v-for="o in g.options" :key="o.id" class="st-opt">
                {{ o.label }}<text v-if="o.extraPrice">+{{ o.extraPrice }}</text>
              </text>
            </view>
          </view>

          <view class="new-group">
            <view class="f-label">新建规格组</view>
            <view class="ng-row">
              <input v-model="newGroup.name" class="f-input" placeholder="组名，如：糖度" />
              <picker :range="['SINGLE', 'MULTI']" @change="(e:any)=>newGroup.type=['SINGLE','MULTI'][Number(e.detail.value)]">
                <view class="mini-btn">{{ newGroup.type === "MULTI" ? "多选" : "单选" }}</view>
              </picker>
            </view>
            <view v-for="(o, idx) in newGroup.options" :key="idx" class="ng-opt-row">
              <input v-model="o.label" class="f-input" placeholder="选项名" />
              <input v-model="o.extraPrice" class="f-input ng-extra" type="digit" placeholder="加价" />
              <view class="mini-btn" @tap="newGroup.options.splice(idx, 1)">删</view>
            </view>
            <view class="mini-btn" @tap="addOption">＋ 选项</view>
            <view class="btn-primary ng-save" @tap="createSpecGroup">保存规格组</view>
          </view>
        </scroll-view>
        <view class="btn-primary save-btn" @tap="save">保存商品</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { API_BASE, STORAGE_KEYS } from "../../config";
import type { Product } from "../../types";

const products = ref<Product[]>([]);
const cats = ref<any[]>([]);
const specGroups = ref<any[]>([]);
const showForm = ref(false);
const filters = reactive({ keyword: "", categoryId: 0, status: "" });
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "在售", value: "on" },
  { label: "售罄", value: "soldout" },
  { label: "已下架", value: "off" },
];
const form = reactive<Record<string, any>>({});
const newGroup = reactive({
  name: "",
  type: "SINGLE" as "SINGLE" | "MULTI",
  options: [{ label: "", extraPrice: 0, isDefault: false }],
});

onShow(loadAll);

async function loadAll() {
  try {
    const [cs, sgs] = await Promise.all([api.adminCategories(), api.adminSpecGroups()]);
    cats.value = cs;
    specGroups.value = sgs;
    await loadProducts();
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

async function loadProducts() {
  try {
    products.value = await api.adminProducts({
      keyword: filters.keyword,
      categoryId: filters.categoryId || undefined,
      status: filters.status,
    });
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function onCatChange(e: any) {
  filters.categoryId = cats.value[Number(e.detail.value)]?.id || 0;
}

function onStatusChange(e: any) {
  filters.status = statusOptions[Number(e.detail.value)].value;
}

function catName(id: number) {
  return cats.value.find((c) => c.id === id)?.name || "";
}

function imgUrl(url: string) {
  return API_BASE.replace(/\/api$/, "") + url;
}

function uploadImage(p: Product) {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const filePath = res.tempFilePaths[0];
      uni.uploadFile({
        url: API_BASE + `/admin/products/${p.id}/image`,
        filePath,
        name: "file",
        header: { Authorization: `Bearer ${uni.getStorageSync(STORAGE_KEYS.adminToken)}` },
        success: (up) => {
          try {
            const body = JSON.parse(up.data as string);
            if (body.code === 0) {
              uni.showToast({ title: "上传成功", icon: "success" });
              loadProducts();
            } else {
              uni.showToast({ title: body.msg || "上传失败", icon: "none" });
            }
          } catch {
            uni.showToast({ title: "上传失败", icon: "none" });
          }
        },
        fail: () => uni.showToast({ title: "上传失败", icon: "none" }),
      });
    },
  });
}

function resetForm() {
  Object.keys(form).forEach((k) => delete form[k]);
  form.categoryId = cats.value[0]?.id;
  form.isSignature = false;
  form.isHot = false;
  form.specEnabled = {};
  form.specRequired = {};
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function openEdit(p: Product) {
  resetForm();
  Object.assign(form, {
    id: p.id,
    name: p.name,
    nameEn: p.nameEn,
    categoryId: p.categoryId,
    price: String(p.price),
    flavorNotes: p.flavorNotes,
    roastLevel: p.roastLevel,
    origin: p.origin,
    description: p.description,
    isSignature: p.isSignature,
    isHot: p.isHot,
  });
  for (const g of p.specGroups) {
    form.specEnabled[g.id] = true;
    form.specRequired[g.id] = g.required;
  }
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
}

function onFormCatChange(e: any) {
  form.categoryId = cats.value[Number(e.detail.value)]?.id;
}

function toggleSpec(groupId: number) {
  form.specEnabled[groupId] = !form.specEnabled[groupId];
  if (form.specEnabled[groupId] && form.specRequired[groupId] === undefined) {
    form.specRequired[groupId] = true;
  }
}

function addOption() {
  newGroup.options.push({ label: "", extraPrice: 0, isDefault: false });
}

async function createSpecGroup() {
  const options = newGroup.options
    .filter((o) => o.label.trim())
    .map((o) => ({
      label: o.label.trim(),
      extraPrice: Number(o.extraPrice || 0),
      isDefault: false,
    }));
  if (!newGroup.name.trim() || !options.length) {
    uni.showToast({ title: "请填写组名和至少一个选项", icon: "none" });
    return;
  }
  try {
    const created = await api.adminCreateSpecGroup({
      name: newGroup.name.trim(),
      type: newGroup.type,
      options,
    });
    form.specEnabled[created.id] = true;
    form.specRequired[created.id] = true;
    newGroup.name = "";
    newGroup.options = [{ label: "", extraPrice: 0, isDefault: false }];
    specGroups.value = await api.adminSpecGroups();
    uni.showToast({ title: "规格组已创建", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "创建失败", icon: "none" });
  }
}

async function save() {
  if (!form.name) {
    uni.showToast({ title: "请填写名称", icon: "none" });
    return;
  }
  const specGroupIds = specGroups.value
    .filter((g) => form.specEnabled[g.id])
    .map((g) => ({ specGroupId: g.id, required: form.specRequired[g.id] !== false }));
  const data = {
    name: form.name,
    nameEn: form.nameEn,
    categoryId: form.categoryId,
    price: Number(form.price),
    flavorNotes: form.flavorNotes,
    roastLevel: form.roastLevel,
    origin: form.origin,
    description: form.description,
    isSignature: form.isSignature === true,
    isHot: form.isHot === true,
    specGroupIds,
  };
  try {
    if (form.id) await api.adminUpdateProduct(form.id, data);
    else await api.adminCreateProduct(data);
    showForm.value = false;
    uni.showToast({ title: "已保存", icon: "success" });
    loadProducts();
  } catch (e: any) {
    uni.showToast({ title: e.message || "保存失败", icon: "none" });
  }
}

async function toggleSoldOut(p: Product) {
  try {
    await api.adminToggleSoldOut(p.id, !p.isSoldOut);
    loadProducts();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function toggleActive(p: Product) {
  try {
    await api.adminUpdateProduct(p.id, { isActive: !p.isActive });
    loadProducts();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function remove(p: Product) {
  const res = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: "删除商品",
      content: `确认删除「${p.name}」？`,
      success: (m) => resolve(!!m.confirm),
    });
  });
  if (!res) return;
  try {
    await api.adminDeleteProduct(p.id);
    uni.showToast({ title: "已删除", icon: "success" });
    loadProducts();
  } catch (e: any) {
    uni.showToast({ title: e.message || "删除失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.filter-row {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.search {
  width: 100%;
  box-sizing: border-box;
}

.filter-actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
  flex-wrap: wrap;
}

.f-input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.f-textarea {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  width: 100%;
  min-height: 120rpx;
  box-sizing: border-box;
}

.mini-btn {
  border: 1px solid #2f2a26;
  color: #2f2a26;
  border-radius: 24px;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  background: #fff;
}

.mini-btn.primary {
  background: #2f2a26;
  color: #fff;
}

.danger {
  border-color: #b04a3a;
  color: #b04a3a;
}

.p-img {
  width: 100%;
  height: 240rpx;
  border-radius: 12px;
  margin-bottom: 16rpx;
  background: #f0e9df;
}

.p-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.p-name {
  font-size: 30rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.p-tags {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}

.p-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}

.add-bar {
  margin-top: 24rpx;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}

.sheet {
  background: #fff;
  width: 100%;
  border-radius: 24px 24px 0 0;
  padding: 32rpx;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.form-scroll {
  max-height: 66vh;
}

.f-label {
  font-size: 24rpx;
  color: #6b625b;
  margin: 16rpx 0 8rpx;
}

.f-label.section {
  border-top: 1px solid #f0ebe4;
  padding-top: 20rpx;
  margin-top: 24rpx;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  font-size: 28rpx;
}

.spec-template {
  border: 1px solid #ece4da;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.st-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.st-check {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.st-name {
  font-size: 28rpx;
  font-weight: 600;
}

.st-type {
  font-size: 20rpx;
  color: #c4a484;
}

.st-required {
  display: flex;
  align-items: center;
  font-size: 22rpx;
  color: #6b625b;
}

.st-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}

.st-opt {
  background: #f4f0ea;
  border-radius: 8px;
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  color: #6b4f2f;
}

.new-group {
  border: 1px dashed #d8cbb8;
  border-radius: 12px;
  padding: 20rpx;
  margin-top: 8rpx;
}

.ng-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.ng-row .f-input {
  flex: 1;
}

.ng-opt-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-top: 12rpx;
}

.ng-opt-row .f-input {
  flex: 1;
}

.ng-extra {
  max-width: 160rpx;
}

.ng-save {
  margin-top: 16rpx;
}

.save-btn {
  margin-top: 24rpx;
}
</style>
