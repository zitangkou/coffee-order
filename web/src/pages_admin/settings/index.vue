<template>
  <view class="page">
    <view class="card">
      <view class="f-label">店铺名称</view>
      <input v-model="form.name" class="f-input" />
      <view class="f-label">品牌文案</view>
      <input v-model="form.slogan" class="f-input" />
      <view class="f-label">营业时间</view>
      <input v-model="form.businessHours" class="f-input" placeholder="08:00 - 20:00" />
      <view class="f-label">公告</view>
      <input v-model="form.announcement" class="f-input" />
      <view class="f-label">外带包装费</view>
      <input v-model="form.packFee" class="f-input" type="digit" />
    </view>

    <view class="card">
      <view class="switch-row">
        <text>营业中（接单）</text>
        <switch :checked="form.acceptOrders" color="#2F2A26" @change="(e:any)=>form.acceptOrders=e.detail.value" />
      </view>
      <view class="switch-row">
        <text>堂食</text>
        <switch :checked="form.dineInEnabled" color="#2F2A26" @change="(e:any)=>form.dineInEnabled=e.detail.value" />
      </view>
      <view class="switch-row">
        <text>外带</text>
        <switch :checked="form.takeoutEnabled" color="#2F2A26" @change="(e:any)=>form.takeoutEnabled=e.detail.value" />
      </view>
      <view class="switch-row">
        <text>允许顾客申请退款</text>
        <switch :checked="form.refundEnabled" color="#2F2A26" @change="(e:any)=>form.refundEnabled=e.detail.value" />
      </view>
      <view class="switch-row">
        <text>外带需填手机号后四位</text>
        <switch :checked="form.takeoutPhoneRequired" color="#2F2A26" @change="(e:any)=>form.takeoutPhoneRequired=e.detail.value" />
      </view>
    </view>

    <view class="btn-primary" @tap="save">保存设置</view>
    <view class="btn-outline test-btn" @tap="testPrinter">测试打印</view>

    <view class="card pwd-card">
      <view class="section-title">修改密码</view>
      <view class="f-label">旧密码</view>
      <input v-model="oldPassword" class="f-input" password placeholder="当前密码" />
      <view class="f-label">新密码（至少 8 位）</view>
      <input v-model="newPassword" class="f-input" password placeholder="新密码" />
      <view class="f-label">确认新密码</view>
      <input v-model="confirmPassword" class="f-input" password placeholder="再次输入新密码" />
      <view class="btn-primary pwd-btn" @tap="changePassword">修改密码</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { api } from "../../api";

const form = reactive<Record<string, any>>({
  name: "",
  slogan: "",
  businessHours: "",
  announcement: "",
  packFee: 0,
  acceptOrders: true,
  dineInEnabled: true,
  takeoutEnabled: true,
  refundEnabled: true,
  takeoutPhoneRequired: false,
});
const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");

onShow(async () => {
  try {
    const s = await api.adminSettings();
    if (s) Object.assign(form, s);
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
});

async function save() {
  try {
    await api.adminSaveSettings({
      ...form,
      packFee: Number(form.packFee || 0),
    });
    uni.showToast({ title: "已保存", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "保存失败", icon: "none" });
  }
}

async function testPrinter() {
  try {
    await api.adminPrinterTest();
    uni.showToast({ title: "测试打印已发送", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "发送失败", icon: "none" });
  }
}

async function changePassword() {
  if (!oldPassword.value || !newPassword.value) {
    uni.showToast({ title: "请填写完整", icon: "none" });
    return;
  }
  if (newPassword.value.length < 6) {
    uni.showToast({ title: "新密码至少 8 位", icon: "none" });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: "两次输入的新密码不一致", icon: "none" });
    return;
  }
  try {
    await api.adminChangePassword(oldPassword.value, newPassword.value);
    oldPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    uni.showToast({ title: "密码已修改", icon: "success" });
  } catch (e: any) {
    uni.showToast({ title: e.message || "修改失败", icon: "none" });
  }
}
</script>

<style lang="scss" scoped>
.f-label {
  font-size: 24rpx;
  color: #6b625b;
  margin: 16rpx 0 8rpx;
}

.f-input {
  background: #f7f4f0;
  border-radius: 12px;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  font-size: 28rpx;
}

.test-btn {
  margin-top: 20rpx;
}

.pwd-card {
  margin-top: 24rpx;
}

.pwd-btn {
  margin-top: 24rpx;
}
</style>
