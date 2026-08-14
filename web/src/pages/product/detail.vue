<template>
  <view class="page detail">
    <view class="img">
      <image v-if="product?.imageUrl" :src="product.imageUrl" mode="aspectFill" class="img-main" />
      <text v-else class="img-text">{{ product?.name?.slice(0, 1) || "☕" }}</text>
      <view class="back" @tap="goBack">‹</view>
    </view>

    <view class="card info">
      <view class="name">
        {{ product?.name }}
        <text v-if="product?.nameEn" class="en">{{ product.nameEn }}</text>
      </view>
      <view class="price-line">
        <text class="price">¥{{ product?.price }}</text>
        <text v-if="product?.roastLevel" class="tag">{{ product.roastLevel }}</text>
      </view>
      <view v-if="product?.description" class="desc">{{ product.description }}</view>
      <view v-if="product?.flavorNotes" class="notes">风味 · {{ product.flavorNotes }}</view>
      <view v-if="product?.origin" class="notes">产区 · {{ product.origin }}</view>
    </view>

    <view class="card" v-if="specGroups.length">
      <view v-for="group in specGroups" :key="group.name" class="spec-group">
        <view class="spec-name">{{ group.name }}</view>
        <view class="spec-options">
          <view
            v-for="opt in group.options"
            :key="opt.label"
            class="spec-opt"
            :class="isSelected(group.name, opt.label) ? 'spec-opt-active' : ''"
            @tap="toggleOption(group, opt)"
          >
            {{ opt.label }}<text v-if="opt.extra" class="opt-extra">+{{ opt.extra }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="spec-name">备注</view>
      <input v-model="remark" class="remark" placeholder="请输入特殊需求（如：不要太烫）" />
    </view>

    <view class="card qty-card">
      <text>数量</text>
      <view class="stepper">
        <view class="step-btn" @tap="changeQty(-1)">−</view>
        <text class="qty">{{ quantity }}</text>
        <view class="step-btn" @tap="changeQty(1)">＋</view>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="total">
        <text class="text-sub">合计</text>
        <text class="price total-price">¥{{ unitPrice * quantity }}</text>
      </view>
      <view class="cart-btn" @tap="addToCart">加入购物车</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import type { Product, SpecOption } from "../../types";

const product = ref<Product | null>(null);
const quantity = ref(1);
const remark = ref("");
const selections = ref<Record<string, string[]>>({});
const cart = useCartStore();

const specGroups = computed(() => {
  if (!product.value) return [];
  return Object.entries(product.value.specsJson).map(([name, options]) => ({
    name,
    options,
  }));
});

const unitPrice = computed(() => {
  if (!product.value) return 0;
  let total = Number(product.value.price);
  for (const group of specGroups.value) {
    const sel = selections.value[group.name] ?? [];
    for (const label of sel) {
      const opt = group.options.find((o) => o.label === label);
      if (opt) total += Number(opt.extra || 0);
    }
  }
  return Math.round(total * 100) / 100;
});

onLoad(async (options) => {
  const id = Number((options as any)?.id);
  try {
    product.value = await api.getProduct(id);
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

function isSelected(groupName: string, label: string) {
  return (selections.value[groupName] ?? []).includes(label);
}

function toggleOption(group: { name: string; options: SpecOption[] }, opt: SpecOption) {
  const current = selections.value[group.name] ?? [];
  // 单选组取第一个选项为默认，这里按单选处理：组内互斥
  if (current.includes(opt.label)) {
    selections.value[group.name] = current.filter((l) => l !== opt.label);
  } else {
    selections.value[group.name] = [opt.label];
  }
}

function changeQty(delta: number) {
  quantity.value = Math.max(1, Math.min(99, quantity.value + delta));
}

function addToCart() {
  if (!product.value) return;
  const specs: Record<string, string> = {};
  for (const [name, sel] of Object.entries(selections.value)) {
    if (sel.length) specs[name] = sel[0];
  }
  cart.add({
    productId: product.value.id,
    name: product.value.name,
    image: product.value.imageUrl,
    specs,
    unitPrice: unitPrice.value,
    quantity: quantity.value,
  });
  uni.showToast({ title: "已加入购物车", icon: "success" });
  setTimeout(() => uni.navigateBack(), 400);
}

function goBack() {
  uni.navigateBack();
}
</script>

<style lang="scss" scoped>
.detail {
  padding-bottom: 180rpx;
}

.img {
  height: 420rpx;
  border-radius: 16px;
  background: linear-gradient(150deg, #efe6da, #d9c9b4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.img-main {
  width: 100%;
  height: 100%;
}

.img-text {
  font-size: 140rpx;
  color: #8a7158;
}

.back {
  position: absolute;
  top: 24rpx;
  left: 24rpx;
  width: 64rpx;
  height: 64rpx;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  border-radius: 50%;
  text-align: center;
  line-height: 58rpx;
  font-size: 40rpx;
}

.name {
  font-size: 36rpx;
  font-weight: 700;
}

.en {
  font-size: 24rpx;
  color: #b9b0a6;
  font-weight: 400;
  margin-left: 12rpx;
}

.price-line {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 12rpx 0;
}

.desc {
  color: #6b625b;
  font-size: 26rpx;
  line-height: 1.7;
}

.notes {
  color: #8a7158;
  font-size: 24rpx;
  margin-top: 8rpx;
}

.spec-group {
  margin-bottom: 24rpx;
}

.spec-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.spec-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.spec-opt {
  border: 1px solid #e0d8cd;
  border-radius: 12px;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  color: #4a3d31;
  background: #fff;
}

.spec-opt-active {
  border-color: #2f2a26;
  background: #2f2a26;
  color: #fff;
}

.opt-extra {
  color: #c4a484;
  margin-left: 4rpx;
}

.remark {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.qty-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.step-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 1px solid #e0d8cd;
  text-align: center;
  line-height: 52rpx;
  font-size: 30rpx;
}

.qty {
  font-size: 30rpx;
  font-weight: 600;
  min-width: 40rpx;
  text-align: center;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
}

.total-price {
  font-size: 40rpx;
  margin-left: 12rpx;
}

.cart-btn {
  background: #2f2a26;
  color: #fff;
  border-radius: 24px;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0 56rpx;
  font-weight: 600;
}
</style>
