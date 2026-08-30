<template>
  <span class="status-badge" :class="`status-${status.toLowerCase()}`"
    ><i />{{ text }}</span
  >
</template>
<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ status: string }>();
const text = computed(
  () =>
    (
      ({
        UNPAID: "待支付",
        PAID: "待接单",
        MAKING: "制作中",
        READY: "待取餐",
        COMPLETED: "已完成",
        REFUNDING: "退款中",
        REFUNDED: "已退款",
        CANCELLED: "已取消",
      }) as Record<string, string>
    )[props.status] || props.status,
);
</script>
