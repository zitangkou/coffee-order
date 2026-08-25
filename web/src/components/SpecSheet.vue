<template>
  <view v-if="show" class="mask" @tap="close">
    <view class="sheet" @tap.stop>
      <view class="head">
        <image v-if="product?.imageUrl" :src="assetUrl(product.imageUrl)" class="thumb" mode="aspectFill" />
        <view v-else class="thumb thumb-text">{{ product?.name?.slice(0, 1) }}</view>
        <view class="head-info">
          <view class="name">{{ product?.name }}</view>
          <view class="head-price">¥{{ unitPrice }}</view>
        </view>
        <view class="close" @tap="close">×</view>
      </view>

      <scroll-view scroll-y class="body">
        <view v-for="group in groups" :key="group.id" class="spec-group">
          <view class="spec-name">
            {{ group.name }}
            <text class="hint">{{ group.type === "MULTI" ? "可多选" : group.required ? "必选" : "选填" }}</text>
          </view>
          <view class="spec-options">
            <view
              v-for="opt in group.options"
              :key="opt.id"
              class="spec-opt"
              :class="isSelected(group, opt) ? 'spec-opt-active' : ''"
              @tap="toggle(group, opt)"
            >
              {{ opt.label }}<text v-if="opt.extraPrice" class="opt-extra">+{{ opt.extraPrice }}</text>
            </view>
          </view>
        </view>

        <view class="row">
          <text class="row-label">数量</text>
          <view class="stepper">
            <view class="step-btn" @tap="changeQty(-1)">−</view>
            <text class="qty">{{ quantity }}</text>
            <view class="step-btn" @tap="changeQty(1)">＋</view>
          </view>
        </view>

        <view class="remark-wrap">
          <text class="row-label">备注</text>
          <input v-model="remark" class="remark" placeholder="特殊需求，如：不要太烫" />
        </view>
      </scroll-view>

      <view class="bar">
        <view class="total">
          <text class="total-label">合计</text>
          <text class="total-price">¥{{ totalPrice }}</text>
        </view>
        <view class="add-btn" @tap="add">加入购物车</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Product, SpecGroup, SpecOption } from "../types";
import { assetUrl } from "../utils/assets";

const props = defineProps<{
  show: boolean;
  product: Product | null;
}>();

const emit = defineEmits<{
  (e: "update:show", v: boolean): void;
  (e: "add", payload: {
    product: Product;
    specs: Record<string, string | string[]>;
    quantity: number;
    remark: string;
    unitPrice: number;
  }): void;
}>();

const selections = ref<Record<string, string[]>>({});
const quantity = ref(1);
const remark = ref("");

const groups = computed<SpecGroup[]>(() => props.product?.specGroups ?? []);

const unitPrice = computed(() => {
  if (!props.product) return 0;
  let total = Number(props.product.price);
  for (const group of groups.value) {
    for (const label of selections.value[group.name] ?? []) {
      const opt = group.options.find((o) => o.label === label);
      if (opt) total += Number(opt.extraPrice || 0);
    }
  }
  return Math.round(total * 100) / 100;
});

const totalPrice = computed(() =>
  Math.round(unitPrice.value * quantity.value * 100) / 100
);

watch(
  () => [props.show, props.product?.id] as const,
  () => {
    if (props.show && props.product) {
      initSelections();
      quantity.value = 1;
      remark.value = "";
    }
  },
  { immediate: true }
);

function initSelections() {
  const sel: Record<string, string[]> = {};
  for (const group of groups.value) {
    const defaults = group.options.filter((o) => o.isDefault).map((o) => o.label);
    if (group.type === "MULTI") {
      sel[group.name] = defaults;
    } else if (defaults.length) {
      sel[group.name] = [defaults[0]];
    } else if (group.required && group.options.length) {
      sel[group.name] = [group.options[0].label];
    } else {
      sel[group.name] = [];
    }
  }
  selections.value = sel;
}

function isSelected(group: SpecGroup, opt: SpecOption) {
  return (selections.value[group.name] ?? []).includes(opt.label);
}

function toggle(group: SpecGroup, opt: SpecOption) {
  const current = selections.value[group.name] ?? [];
  if (current.includes(opt.label)) {
    selections.value[group.name] = current.filter((l) => l !== opt.label);
  } else if (group.type === "MULTI") {
    selections.value[group.name] = [...current, opt.label];
  } else {
    selections.value[group.name] = [opt.label];
  }
}

function changeQty(delta: number) {
  quantity.value = Math.max(1, Math.min(99, quantity.value + delta));
}

function add() {
  if (!props.product) return;
  const specs: Record<string, string | string[]> = {};
  for (const group of groups.value) {
    const sel = selections.value[group.name] ?? [];
    if (sel.length) specs[group.name] = group.type === "MULTI" ? sel : sel[0];
  }
  emit("add", {
    product: props.product,
    specs,
    quantity: quantity.value,
    remark: remark.value,
    unitPrice: unitPrice.value,
  });
}

function close() {
  emit("update:show", false);
}
</script>

<style lang="scss" scoped>
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
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  padding: 28rpx 28rpx 8rpx;
  gap: 20rpx;
}

.thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12px;
  background: #f0e9df;
}

.thumb-text {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: #8a7158;
  font-weight: 700;
}

.head-info {
  flex: 1;
}

.name {
  font-size: 32rpx;
  font-weight: 700;
}

.head-price {
  color: #2f2a26;
  font-weight: 700;
  font-size: 32rpx;
  margin-top: 8rpx;
}

.close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #f4f0ea;
  text-align: center;
  line-height: 52rpx;
  font-size: 36rpx;
  color: #6b625b;
}

.body {
  max-height: 56vh;
  padding: 8rpx 28rpx 24rpx;
  box-sizing: border-box;
}

.spec-group {
  margin-bottom: 24rpx;
}

.spec-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.hint {
  font-size: 20rpx;
  font-weight: 400;
  color: #c4a484;
  margin-left: 8rpx;
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

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
}

.row-label {
  font-size: 28rpx;
  font-weight: 600;
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
  min-width: 40rpx;
  text-align: center;
  font-weight: 600;
}

.remark-wrap {
  padding: 16rpx 0 8rpx;
}

.remark {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  margin-top: 12rpx;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 28rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1px solid #f0ebe4;
}

.total {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.total-label {
  color: #6b625b;
  font-size: 24rpx;
}

.total-price {
  font-size: 40rpx;
  font-weight: 700;
  color: #2f2a26;
}

.add-btn {
  background: #2f2a26;
  color: #fff;
  border-radius: 24px;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0 48rpx;
  font-weight: 600;
}
</style>
