<template>
  <view class="page login">
    <view class="card form">
      <view class="logo">Coffee OS</view>
      <view class="sub">商家后台</view>
      <input v-model="username" class="input" placeholder="用户名" />
      <input v-model="password" class="input" placeholder="密码" password />
      <view class="btn-primary" @tap="login">登 录</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";
import { STORAGE_KEYS } from "../../config";

const username = ref("");
const password = ref("");

async function login() {
  if (!username.value || !password.value) {
    uni.showToast({ title: "请输入用户名和密码", icon: "none" });
    return;
  }
  try {
    uni.showLoading({ title: "登录中" });
    const data = await api.adminLogin(username.value, password.value);
    uni.setStorageSync(STORAGE_KEYS.adminToken, data.token);
    uni.setStorageSync(STORAGE_KEYS.adminInfo, data.admin);
    uni.hideLoading();
    uni.redirectTo({ url: "/pages_admin/dashboard/index" });
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "登录失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 48rpx 32rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.form {
  width: 100%;
  max-width: 640rpx;
  margin: 0 auto;
  padding: 64rpx 40rpx;
  text-align: center;
}

.logo {
  font-size: 48rpx;
  font-weight: 800;
  color: #2f2a26;
}

.sub {
  color: #6b625b;
  margin: 8rpx 0 40rpx;
}

.input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}
</style>
