<template>
  <view class="page">
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
        <text v-if="p.flavorNotes" class="text-sub">{{ p.flavorNotes }}</text>
      </view>
      <view class="p-actions">
        <view class="mini-btn" @tap="uploadImage(p)">传图</view>
        <view class="mini-btn" @tap="toggleSoldOut(p)">{{ p.isSoldOut ? "恢复在售" : "标记售罄" }}</view>
        <view class="mini-btn" @tap="toggleActive(p)">{{ p.isActive ? "下架" : "上架" }}</view>
        <view class="mini-btn" @tap="openEdit(p)">编辑</view>
        <view class="mini-btn danger" @tap="remove(p)">删除</view>
      </view>
    </view>

    <view class="add-bar btn-primary" @tap="openCreate">＋ 新增商品</view>

    <view v-if="showForm" class="mask" @tap="closeForm">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">{{ form.id ? "编辑商品" : "新增商品" }}</view>
        <scroll-view scroll-y class="form-scroll">
          <view class="f-label">名称</view>
          <input v-model="form.name" class="f-input" placeholder="商品名称" />
          <view class="f-label">英文名</view>
          <input v-model="form.nameEn" class="f-input" placeholder="选填" />
          <view class="f-label">分类</view>
          <picker :range="cats" range-key="name" @change="onCatChange">
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
          <view class="f-label">规格 JSON（可选）</view>
          <textarea v-model="specsText" class="f-textarea mono" placeholder='{"杯型":[{"label":"标准","extra":0},{"label":"大杯","extra":5}]}' />
        </scroll-view>
        <view class="btn-primary save-btn" @tap="save">保存</view>
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
const showForm = ref(false);
const specsText = ref("{}");
const form = reactive<Record<string, any>>({});

onShow(load);

async function load() {
  try {
    const [ps, cs] = await Promise.all([api.adminProducts(), api.adminCategories()]);
    products.value = ps;
    cats.value = cs;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
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
              load();
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

function openCreate() {
  Object.keys(form).forEach((k) => delete form[k]);
  form.categoryId = cats.value[0]?.id;
  specsText.value = "{}";
  showForm.value = true;
}

function openEdit(p: Product) {
  Object.keys(form).forEach((k) => delete form[k]);
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
  });
  specsText.value = JSON.stringify(p.specsJson || {}, null, 2);
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
}

function onCatChange(e: any) {
  form.categoryId = cats.value[Number(e.detail.value)]?.id;
}

async function save() {
  if (!form.name) {
    uni.showToast({ title: "请填写名称", icon: "none" });
    return;
  }
  let specsJson = {};
  try {
    specsJson = specsText.value.trim() ? JSON.parse(specsText.value) : {};
  } catch {
    uni.showToast({ title: "规格 JSON 格式错误", icon: "none" });
    return;
  }
  const data = {
    name: form.name,
    nameEn: form.nameEn,
    categoryId: form.categoryId,
    price: Number(form.price),
    flavorNotes: form.flavorNotes,
    roastLevel: form.roastLevel,
    origin: form.origin,
    description: form.description,
    specsJson,
  };
  try {
    if (form.id) await api.adminUpdateProduct(form.id, data);
    else await api.adminCreateProduct(data);
    showForm.value = false;
    uni.showToast({ title: "已保存", icon: "success" });
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "保存失败", icon: "none" });
  }
}

async function toggleSoldOut(p: Product) {
  try {
    await api.adminToggleSoldOut(p.id, !p.isSoldOut);
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "操作失败", icon: "none" });
  }
}

async function toggleActive(p: Product) {
  try {
    await api.adminUpdateProduct(p.id, { isActive: !p.isActive });
    load();
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
    load();
  } catch (e: any) {
    uni.showToast({ title: e.message || "删除失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.p-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.p-img {
  width: 100%;
  height: 240rpx;
  border-radius: 12px;
  margin-bottom: 16rpx;
  background: #f0e9df;
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
  gap: 16rpx;
  margin-top: 12rpx;
}

.p-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}

.mini-btn {
  border: 1px solid #2f2a26;
  color: #2f2a26;
  border-radius: 24px;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
}

.danger {
  border-color: #b04a3a;
  color: #b04a3a;
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
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.form-scroll {
  max-height: 60vh;
}

.f-label {
  font-size: 24rpx;
  color: #6b625b;
  margin: 16rpx 0 8rpx;
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

.mono {
  font-family: monospace;
  font-size: 22rpx;
}

.save-btn {
  margin-top: 24rpx;
}
</style>
