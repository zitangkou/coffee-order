<template>
  <div>
    <div class="page-heading">
      <div>
        <h1>{{ route.meta.title }}</h1>
        <p>桌面管理端功能正在按阶段迁移</p>
      </div>
    </div>
    <article class="panel placeholder-panel">
      <div class="placeholder-icon">{{ icon }}</div>
      <h2>{{ route.meta.title }}桌面版</h2>
      <p>{{ description }}</p>
      <el-tag type="warning" effect="light">下一开发批次</el-tag>
      <div class="placeholder-list">
        <span v-for="item in items" :key="item">✓ {{ item }}</span>
      </div>
    </article>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();
const data: Record<
  string,
  { icon: string; description: string; items: string[] }
> = {
  products: {
    icon: "☕",
    description: "商品、分类、规格、图片与售罄状态集中管理。",
    items: ["批量上下架", "规格规则校验", "图片维护"],
  },
  tables: {
    icon: "▦",
    description: "桌台状态、小程序码和打印排版管理。",
    items: ["批量生成桌码", "A4 打印", "停用保护"],
  },
  members: {
    icon: "◎",
    description: "会员消费数据、等级和最近订单查询。",
    items: ["敏感信息脱敏", "消费趋势", "用户标签"],
  },
  analytics: {
    icon: "↗",
    description: "经营、商品、时段、退款和效率分析。",
    items: ["统一统计口径", "数据导出", "趋势对比"],
  },
  settings: {
    icon: "⚙",
    description: "门店资料、营业配置和打印服务设置。",
    items: ["基础资料", "订单规则", "打印测试"],
  },
  admins: {
    icon: "♟",
    description: "员工账户、角色权限和操作审计。",
    items: ["RBAC 权限", "会话失效", "审计日志"],
  },
};
const current = computed(
  () => data[String(route.meta.module)] || data.analytics,
);
const icon = computed(() => current.value.icon);
const description = computed(() => current.value.description);
const items = computed(() => current.value.items);
</script>
