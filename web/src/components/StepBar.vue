<template>
  <view class="steps">
    <view v-for="(s, idx) in steps" :key="s.key" class="step">
      <view class="step-top">
        <view class="dot" :class="dotClass(idx)">
          <text v-if="idx < current" class="check">✓</text>
          <text v-else-if="idx === current" class="pulse" />
        </view>
        <view v-if="idx < steps.length - 1" class="connector" :class="{ 'connector-done': idx < current }" />
      </view>
      <text class="label" :class="{ 'label-active': idx === current, 'label-done': idx < current }">{{ s.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { OrderStatus } from "../types";

const props = defineProps<{ status: OrderStatus }>();

const steps = [
  { key: "PAID", label: "已支付" },
  { key: "MAKING", label: "制作中" },
  { key: "READY", label: "待取餐" },
  { key: "COMPLETED", label: "已完成" },
];

const current = computed(() => {
  const idx = steps.findIndex((s) => s.key === props.status);
  return idx >= 0 ? idx : props.status === "COMPLETED" ? 3 : -1;
});

function dotClass(idx: number) {
  if (idx < current.value) return "dot-done";
  if (idx === current.value) return "dot-active";
  return "dot-todo";
}
</script>

<style lang="scss" scoped>
.steps {
  display: flex;
  margin: 32rpx 0 8rpx;
}

.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-top {
  width: 100%;
  display: flex;
  align-items: center;
}

.dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.connector {
  flex: 1;
  height: 4rpx;
  background: #e8e2db;
}

.connector-done {
  background: #3e7c59;
}

.dot-todo {
  background: #fff;
  border: 2rpx solid #d8d0c6;
}

.dot-done {
  background: #3e7c59;
  color: #fff;
}

.dot-active {
  background: #2f2a26;
  color: #fff;
}

.check {
  font-size: 26rpx;
  font-weight: 700;
}

.pulse {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #c4a484;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(1.5);
  }
}

.label {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #b9b0a6;
}

.label-active {
  color: #2f2a26;
  font-weight: 700;
}

.label-done {
  color: #3e7c59;
}
</style>
