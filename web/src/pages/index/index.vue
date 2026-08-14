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
          @tap="switchMode('DINE_IN')"
        >
          堂食{{ user.tableNo ? " · " + user.tableNo : "" }}
        </view>
        <view
          class="mode"
          :class="user.orderType === 'TAKEOUT' ? 'mode-active' : ''"
          @tap="switchMode('TAKEOUT')"
        >
          外带
        </view>
      </view>
    </view>

    <scroll-view scroll-x class="cats" :show-scrollbar="false">
      <view
        v-for="c in categories"
        :key="c.id"
        class="cat"
        :class="activeCat === c.id ? 'cat-active' : ''"
        @tap="switchCat(c.id)"
      >
        {{ c.name }}
      </view>
    </scroll-view>

    <view class="products">
      <view v-for="p in currentProducts" :key="p.id" class="product card" @tap="goDetail(p.id)">
        <view class="p-img">
          <image v-if="p.imageUrl" :src="p.imageUrl" mode="aspectFill" class="p-img-img" />
          <text v-else class="p-img-text">{{ p.name.slice(0, 1) }}</text>
          <view v-if="p.isSoldOut" class="sold-out">售罄</view>
        </view>
        <view class="p-info">
          <view class="p-name">
            {{ p.name }}
            <text v-if="p.nameEn" class="p-en">{{ p.nameEn }}</text>
          </view>
          <view v-if="p.flavorNotes" class="p-notes">{{ p.flavorNotes }}</view>
          <view class="p-meta">
            <text v-if="p.roastLevel" class="tag tag-light">{{ p.roastLevel }}</text>
          </view>
          <view class="p-bottom">
            <text class="price">¥{{ p.price }}</text>
            <view class="add-btn" @tap.stop="goDetail(p.id)">＋</view>
          </view>
        </view>
      </view>
      <view v-if="!currentProducts.length" class="empty">本分类暂无商品</view>
    </view>

    <view class="admin-entry" @tap="goAdmin">商家后台</view>

    <view v-if="cart.count > 0" class="cart-bar">
      <view class="cart-info" @tap="goCart">
        <view class="cart-count">{{ cart.count }}</view>
        <text class="cart-total">¥{{ cart.total }}</text>
      </view>
      <view class="cart-btn" @tap="goCheckout">去结算</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useUserStore } from "../../stores/user";
import { applyTableId } from "../../utils/table";
import type { Category, Shop } from "../../types";

const user = useUserStore();
const cart = useCartStore();
const categories = ref<Category[]>([]);
const shop = ref<Shop | null>(null);
const activeCat = ref(0);

const currentProducts = computed(() => {
  const cat = categories.value.find((c) => c.id === activeCat.value);
  return cat?.products ?? [];
});

onLoad(async (options) => {
  await user.ensureLogin();
  await applyTableId((options as any)?.table_id);
  loadData();
});

onShow(() => {
  loadData();
});

async function loadData() {
  try {
    const [cats, s] = await Promise.all([api.getCategories(), api.getShop()]);
    categories.value = cats;
    shop.value = s;
    if (!activeCat.value && cats.length) activeCat.value = cats[0].id;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function switchCat(id: number) {
  activeCat.value = id;
}

function switchMode(type: "DINE_IN" | "TAKEOUT") {
  user.setOrderType(type);
  if (type === "TAKEOUT") user.setTable(null);
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

.cats {
  white-space: nowrap;
  margin: 24rpx 0 8rpx;
}

.cat {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  background: #fff;
  border-radius: 24px;
  color: #6b625b;
  font-size: 26rpx;
}

.cat-active {
  background: #2f2a26;
  color: #fff;
  font-weight: 600;
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

.p-meta {
  margin-top: 8rpx;
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
</style>
