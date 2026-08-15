<template>
  <view class="page login">
    <view class="card form">
      <view class="logo">修改密码</view>
      <view class="sub">首次登录或重置密码后需修改密码才能继续</view>
      <input v-model="oldPassword" class="input" password placeholder="当前密码" />
      <input v-model="newPassword" class="input" password placeholder="新密码（至少 8 位）" />
      <input v-model="confirmPassword" class="input" password placeholder="确认新密码" />
      <view class="btn-primary" @tap="submit">确认修改</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";

const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

async function submit() {
  if (!oldPassword.value || !newPassword.value) {
    uni.showToast({ title: "请填写完整", icon: "none" });
    return;
  }
  if (newPassword.value.length < 8) {
    uni.showToast({ title: "新密码至少 8 位", icon: "none" });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: "两次输入的新密码不一致", icon: "none" });
    return;
  }
  try {
    uni.showLoading({ title: "提交中" });
    await api.adminChangePassword(oldPassword.value, newPassword.value);
    uni.hideLoading();
    uni.showToast({ title: "密码已修改", icon: "success" });
    setTimeout(() => uni.redirectTo({ url: "/pages_admin/dashboard/index" }), 600);
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || "修改失败", icon: "none" });
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
  font-size: 40rpx;
  font-weight: 800;
  color: #2f2a26;
}

.sub {
  color: #6b625b;
  font-size: 24rpx;
  margin: 12rpx 0 40rpx;
  line-height: 1.6;
}

.input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}
</style>
