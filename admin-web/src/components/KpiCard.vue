<template>
  <article class="kpi-card">
    <div class="kpi-top">
      <span>{{ label }}</span
      ><span class="kpi-icon" :class="tone">{{ icon }}</span>
    </div>
    <strong>{{ prefix }}{{ value }}</strong>
    <div class="kpi-foot">{{ hint }}</div>
  </article>
</template>
<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  prefix?: string;
  hint: string;
  icon: string;
  tone?: string;
}>();
</script>
