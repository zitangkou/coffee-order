<template>
  <view class="page home">
    <view class="hero">
      <view class="hero-name">{{ shop?.name || "Coffee OS" }}</view>
      <view v-if="shop?.slogan" class="hero-slogan">{{ shop.slogan }}</view>
      <view v-if="shop?.businessHours" class="hero-hours">{{ shop.businessHours }}</view>
      <view class="mode-switch">
        <view
          class="mode"
          :class="user.orderType === 'DINE_IN' ? 'mode-active' : ''"
          @tap="onModeTap('DINE_IN')"
        >
          堂食{{ user.tableNo ? " · " + user.tableNo : "" }}<text class="mode-arrow">▾</text>
        </view>
        <view
          class="mode"
          :class="user.orderType === 'TAKEOUT' ? 'mode-active' : ''"
          @tap="onModeTap('TAKEOUT')"
        >
          外带
        </view>
      </view>
    </view>

    <scroll-view scroll-x class="cats" :show-scrollbar="false">
      <view
        v-for="chip in quickChips"
        :key="chip.key"
        class="cat"
        :class="activeTab === chip.key ? 'cat-active' : ''"
        @tap="switchTab(chip.key)"
      >
        {{ chip.label }}
      </view>
      <view class="cat cat-trigger" @tap="showCatDrawer = true">
        {{ activeTabName }}<text class="mode-arrow">▾</text>
      </view>
    </scroll-view>

    <view class="products">
      <view v-for="p in currentProducts" :key="p.id" class="product card" @tap="goDetail(p.id)">
        <view class="p-img">
          <image v-if="p.imageUrl" :src="p.imageUrl" mode="aspectFill" class="p-img-img" />
          <text v-else class="p-img-text">{{ p.name.slice(0, 1) }}</text>
          <view v-if="p.isSoldOut" class="sold-out">售罄</view>
          <view class="badges">
            <text v-if="p.isSignature" class="badge badge-accent">招牌</text>
            <text v-if="p.isHot" class="badge badge-warning">热销</text>
          </view>
        </view>
        <view class="p-info">
          <view class="p-name">
            {{ p.name }}
            <text v-if="p.nameEn" class="p-en">{{ p.nameEn }}</text>
          </view>
          <view v-if="p.flavorNotes" class="p-notes">{{ p.flavorNotes }}</view>
          <view class="p-bottom">
            <text class="price">¥{{ p.price }}</text>
            <view class="add-btn" @tap.stop="openSpecSheet(p)">＋</view>
          </view>
        </view>
      </view>
      <view v-if="!currentProducts.length" class="empty">本分类暂无商品</view>
    </view>

    <view class="member-entry" @tap="goMember">我的咖啡档案</view>
    <view class="admin-entry" @tap="goAdmin">商家后台</view>

    <view v-if="cart.count > 0" class="cart-bar">
      <view class="cart-info" @tap="goCart">
        <view class="cart-count">{{ cart.count }}</view>
        <text class="cart-total">¥{{ cart.total }}</text>
      </view>
      <view class="cart-btn" @tap="goCheckout">去结算</view>
    </view>

    <!-- 分类抽屉 -->
    <view v-if="showCatDrawer" class="mask" @tap="showCatDrawer = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">选择分类</view>
        <input v-model="catKeyword" class="cat-search" placeholder="搜索分类" />
        <scroll-view scroll-y class="cat-list">
          <view
            v-for="c in filteredCats"
            :key="c.id"
            class="cat-item"
            :class="activeTab === c.id ? 'cat-item-active' : ''"
            @tap="pickCategory(c)"
          >
            {{ c.name }}
            <text class="cat-count">{{ c.products.length }}</text>
          </view>
          <view v-if="!filteredCats.length" class="empty">没有匹配的分类</view>
        </scroll-view>
      </view>
    </view>

    <!-- 选桌浮层 -->
    <view v-if="showTablePicker" class="mask" @tap="showTablePicker = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">选择桌号</view>
        <view class="table-grid">
          <view
            v-for="t in tables"
            :key="t.id"
            class="table-item"
            :class="user.tableId === t.id ? 'table-active' : ''"
            @tap="pickTable(t)"
          >
            {{ t.tableNo }}
          </view>
        </view>
      </view>
    </view>

    <SpecSheet v-model:show="showSpecSheet" :product="activeProduct" @add="onAddToCart" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useUserStore } from "../../stores/user";
import { applyTableId } from "../../utils/table";
import SpecSheet from "../../components/SpecSheet.vue";
import type { Category, Product, Shop, Table } from "../../types";

const user = useUserStore();
const cart = useCartStore();
const categories = ref<Category[]>([]);
const shop = ref<Shop | null>(null);
const tables = ref<Table[]>([]);
const activeTab = ref<"all" | "signature" | "hot" | number>("all");
const showCatDrawer = ref(false);
const catKeyword = ref("");
const showTablePicker = ref(false);
const activeProduct = ref<Product | null>(null);
const showSpecSheet = ref(false);

const quickChips = [
  { key: "all", label: "全部" },
  { key: "signature", label: "招牌" },
  { key: "hot", label: "热销" },
];

const activeTabName = computed(() => {
  if (typeof activeTab.value === "number") {
    return categories.value.find((c) => c.id === activeTab.value)?.name || "分类";
  }
  return quickChips.find((c) => c.key === activeTab.value)?.label || "分类";
});

const currentProducts = computed(() => {
  const all = categories.value.flatMap((c) => c.products);
  if (activeTab.value === "signature") return all.filter((p) => p.isSignature);
  if (activeTab.value === "hot") return all.filter((p) => p.isHot);
  if (typeof activeTab.value === "number") {
    return categories.value.find((c) => c.id === activeTab.value)?.products ?? [];
  }
  return all;
});

const filteredCats = computed(() => {
  const kw = catKeyword.value.trim();
  return categories.value.filter((c) => !kw || c.name.includes(kw));
});

onLoad(async (options) => {
  try {
    await user.ensureLogin();
    await applyTableId((options as any)?.table_id);
    loadData();
  } catch (e: any) {
    uni.showToast({ title: `启动失败：${e.message || "未知错误"}`, icon: "none", duration: 5000 });
  }
});

onShow(() => {
  loadData();
});

async function loadData() {
  try {
    const [cats, s, ts] = await Promise.all([api.getCategories(), api.getShop(), api.getTables()]);
    categories.value = cats;
    shop.value = s;
    tables.value = ts;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function switchTab(key: "all" | "signature" | "hot") {
  activeTab.value = key;
}

function pickCategory(c: Category) {
  activeTab.value = c.id;
  showCatDrawer.value = false;
}

function onModeTap(type: "DINE_IN" | "TAKEOUT") {
  if (type === "TAKEOUT") {
    user.setOrderType("TAKEOUT");
    return;
  }
  user.setOrderType("DINE_IN");
  if (!user.tableId) {
    showTablePicker.value = true;
  } else if (type === user.orderType) {
    showTablePicker.value = true;
  }
}

function pickTable(t: Table) {
  user.setTable(t);
  showTablePicker.value = false;
}

function openSpecSheet(p: Product) {
  activeProduct.value = p;
  showSpecSheet.value = true;
}

function onAddToCart(payload: {
  product: Product;
  specs: Record<string, string | string[]>;
  quantity: number;
  remark: string;
  unitPrice: number;
}) {
  cart.add({
    productId: payload.product.id,
    name: payload.product.name,
    image: payload.product.imageUrl,
    specs: payload.specs,
    unitPrice: payload.unitPrice,
    quantity: payload.quantity,
  });
  if (payload.remark) cart.remark = payload.remark;
  showSpecSheet.value = false;
  uni.showToast({ title: "已加入购物车", icon: "success" });
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
}

function goCart() {
  uni.navigateTo({ url: "/pages/cart/index" });
}

function goCheckout() {
  if (!cart.count) {
    uni.showToast({ title: "购物车是空的", icon: "none" });
    return;
  }
  uni.navigateTo({ url: "/pages/order/create" });
}

function goAdmin() {
  uni.navigateTo({ url: "/pages_admin/login/index" });
}

function goMember() {
  uni.navigateTo({ url: "/pages/member/index" });
}
</script>

<style lang="scss" scoped>
.home {
  padding-bottom: 160rpx;
}

.hero {
  background: linear-gradient(160deg, #2f2a26 0%, #4a3d31 100%);
  color: #fff;
  border-radius: 16px;
  padding: 48rpx 32rpx 32rpx;
  margin-top: 16rpx;
}

.hero-name {
  font-size: 40rpx;
  font-weight: 800;
}

.hero-slogan {
  margin-top: 12rpx;
  color: #d8c9b6;
  font-size: 26rpx;
}

.hero-hours {
  margin-top: 8rpx;
  color: #a99a86;
  font-size: 22rpx;
}

.mode-switch {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.mode {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 10rpx 28rpx;
  font-size: 24rpx;
  color: #d8d0c6;
}

.mode-active {
  background: #c4a484;
  color: #fff;
  font-weight: 600;
}

.mode-arrow {
  margin-left: 8rpx;
  font-size: 20rpx;
}

.cats {
  white-space: nowrap;
  margin: 24rpx 0 8rpx;
}

.cat {
  display: inline-block;
  padding: 14rpx 30rpx;
  margin-right: 16rpx;
  background: #fff;
  border: 1px solid #ece4da;
  border-radius: 24px;
  color: #6b625b;
  font-size: 26rpx;
}

.cat-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
  font-weight: 600;
}

.cat-trigger {
  color: #6b4f2f;
  background: #f0e9df;
  border-color: #e0d0ba;
}

.products {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.product {
  width: 48.5%;
  padding: 16rpx;
  box-sizing: border-box;
}

.p-img {
  height: 260rpx;
  border-radius: 12px;
  background: linear-gradient(150deg, #efe6da, #d9c9b4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.p-img-img {
  width: 100%;
  height: 100%;
}

.p-img-text {
  font-size: 72rpx;
  color: #8a7158;
  font-weight: 700;
}

.sold-out {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  text-align: center;
  font-size: 22rpx;
  padding: 6rpx 0;
}

.badges {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  display: flex;
  gap: 8rpx;
}

.p-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-top: 12rpx;
}

.p-en {
  font-size: 20rpx;
  color: #b9b0a6;
  font-weight: 400;
  margin-left: 8rpx;
}

.p-notes {
  color: #6b625b;
  font-size: 22rpx;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.add-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #2f2a26;
  color: #fff;
  text-align: center;
  line-height: 52rpx;
  font-size: 36rpx;
}

.admin-entry {
  text-align: center;
  color: #b9b0a6;
  font-size: 22rpx;
  margin: 32rpx 0 8rpx;
  text-decoration: underline;
}

.member-entry {
  text-align: center;
  color: #6b4f2f;
  font-size: 24rpx;
  font-weight: 600;
  margin: 32rpx 0 0;
}

.cart-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  background: #2f2a26;
  border-radius: 24px;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx 0 28rpx;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.cart-info {
  display: flex;
  align-items: center;
  color: #fff;
}

.cart-count {
  background: #c4a484;
  border-radius: 50%;
  min-width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  font-size: 22rpx;
  margin-right: 16rpx;
  padding: 0 8rpx;
}

.cart-total {
  font-size: 32rpx;
  font-weight: 700;
}

.cart-btn {
  background: #c4a484;
  color: #fff;
  border-radius: 24px;
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 40rpx;
  font-weight: 600;
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
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  max-height: 70vh;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.cat-search {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  margin-bottom: 20rpx;
}

.cat-list {
  max-height: 48vh;
}

.cat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 20rpx;
  border-radius: 12px;
  font-size: 28rpx;
  color: #4a3d31;
}

.cat-item-active {
  background: #2f2a26;
  color: #fff;
}

.cat-count {
  color: #b9b0a6;
  font-size: 22rpx;
}

.table-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.table-item {
  width: 150rpx;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 12px;
  border: 1px solid #e0d8cd;
  font-size: 28rpx;
}

.table-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
}
</style>
