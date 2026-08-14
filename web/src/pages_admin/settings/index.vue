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
  </view>
</template>

<script setup lang="ts">
import { reactive } from "vue";
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
</style>
