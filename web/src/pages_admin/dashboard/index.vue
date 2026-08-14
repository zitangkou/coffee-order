<template>
  <view class="page">
    <view class="card hero">
      <view class="today">今日营业额</view>
      <view class="revenue">¥{{ stats.revenue || 0 }}</view>
      <view class="metrics">
        <view class="metric"><text class="m-num">{{ stats.orderCount || 0 }}</text><text class="m-label">订单数</text></view>
        <view class="metric"><text class="m-num">{{ stats.avgTicket || 0 }}</text><text class="m-label">客单价</text></view>
        <view class="metric"><text class="m-num">{{ stats.pending || 0 }}</text><text class="m-label">待接单</text></view>
      </view>
    </view>

    <view class="grid">
      <view class="grid-item card" v-for="g in entries" :key="g.url" @tap="go(g.url)">
        <view class="g-icon">{{ g.icon }}</view>
        <view class="g-name">{{ g.name }}</view>
      </view>
    </view>

    <view class="logout btn-outline" @tap="logout">退出登录</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { STORAGE_KEYS } from "../../config";

const stats = ref<any>({});
const entries = [
  { icon: "☕", name: "订单管理", url: "/pages_admin/orders/index" },
  { icon: "🍩", name: "商品管理", url: "/pages_admin/products/index" },
  { icon: "🪑", name: "桌台管理", url: "/pages_admin/tables/index" },
  { icon: "📊", name: "数据统计", url: "/pages_admin/stats/index" },
  { icon: "⚙️", name: "系统设置", url: "/pages_admin/settings/index" },
];

onShow(async () => {
  try {
    stats.value = await api.adminStatsToday();
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

function go(url: string) {
  uni.navigateTo({ url });
}

function logout() {
  uni.removeStorageSync(STORAGE_KEYS.adminToken);
  uni.reLaunch({ url: "/pages_admin/login/index" });
}
</script>

<style lang="scss" scoped>
.hero {
  background: linear-gradient(160deg, #2f2a26, #4a3d31);
  color: #fff;
  text-align: center;
  padding: 48rpx 24rpx;
}

.today {
  color: #d8c9b6;
  font-size: 24rpx;
}

.revenue {
  font-size: 72rpx;
  font-weight: 800;
  margin: 12rpx 0 28rpx;
}

.metrics {
  display: flex;
  justify-content: space-around;
}

.metric {
  text-align: center;
}

.m-num {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
}

.m-label {
  color: #b9a98f;
  font-size: 22rpx;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.grid-item {
  width: 48%;
  text-align: center;
  padding: 36rpx 0;
}

.g-icon {
  font-size: 56rpx;
}

.g-name {
  margin-top: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.logout {
  margin-top: 32rpx;
}
</style>
