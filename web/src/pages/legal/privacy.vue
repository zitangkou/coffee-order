<template>
  <view class="legal-page">
    <view class="title">Coffee OS 隐私政策</view>
    <view class="meta">更新日期：2026 年 8 月 29 日</view>

    <view class="section">
      <view class="heading">经营者与联系方式</view>
      <view class="paragraph">经营者：{{ LEGAL_OPERATOR_NAME }}</view>
      <view class="paragraph">客服联系渠道：{{ LEGAL_CUSTOMER_SERVICE }}</view>
      <view class="paragraph">经营地址：{{ LEGAL_STORE_ADDRESS }}</view>
    </view>

    <view class="section">
      <view class="heading">我们处理的信息</view>
      <view class="paragraph">为提供点单服务，我们会处理微信登录标识、订单内容、桌号或取餐信息、订单备注及支付状态。只有在你主动使用咖啡档案或需要取餐核对时，才会处理你提供的手机号。</view>
    </view>
    <view class="section">
      <view class="heading">信息用途</view>
      <view class="paragraph">上述信息用于登录识别、创建和履行订单、支付结果确认、退款处理、取餐通知、售后服务以及展示你本人的消费记录，不用于与点单无关的用途。</view>
    </view>
    <view class="section">
      <view class="heading">权限与订阅消息</view>
      <view class="paragraph">出餐订阅通知仅在你主动同意后发送。拒绝订阅不会影响浏览、下单或支付。我们不会在未说明用途的情况下申请设备权限。</view>
    </view>
    <view class="section">
      <view class="heading">保存与保护</view>
      <view class="paragraph">一般业务信息保存期限：{{ LEGAL_DATA_RETENTION }}。超过期限后将删除或匿名化；法律法规另有要求的交易记录按法定期限保存。我们采取访问控制、传输加密、日志脱敏和备份等措施保护数据。</view>
    </view>
    <view class="section">
      <view class="heading">第三方处理</view>
      <view class="paragraph">登录、支付、退款与订阅通知由微信相关能力处理，必要的订单号、金额和支付状态会在完成对应服务所需范围内传输。我们不会出售个人信息，也不会将信息用于无关营销。</view>
    </view>
    <view class="section">
      <view class="heading">你的权利</view>
      <view class="paragraph">你可以在咖啡档案中查看已绑定手机号和消费记录，并可联系店铺申请更正、解绑或注销账号。涉及支付、退款和依法需要留存的交易记录，注销后将停止用于会员识别，并按适用要求进行删除或匿名化处理。</view>
    </view>
    <view class="notice">如需行使查阅、更正、删除或注销权利，请通过上述客服渠道联系我们。小程序内说明与微信公众平台隐私保护指引应保持一致。</view>
  </view>
</template>

<script setup lang="ts">
import {
  LEGAL_CUSTOMER_SERVICE,
  LEGAL_DATA_RETENTION,
  LEGAL_OPERATOR_NAME,
  LEGAL_STORE_ADDRESS,
} from "../../config";
</script>

<style lang="scss" scoped>
.legal-page { min-height: 100vh; padding: 40rpx 32rpx 80rpx; box-sizing: border-box; background: #f7f4f0; color: #352f2a; }
.title { font-size: 40rpx; font-weight: 700; }
.meta { margin: 12rpx 0 36rpx; color: #85786d; font-size: 24rpx; }
.section { margin-bottom: 32rpx; }
.heading { margin-bottom: 12rpx; font-size: 30rpx; font-weight: 700; }
.paragraph { font-size: 27rpx; line-height: 1.8; color: #554b43; }
.notice { padding: 24rpx; border-radius: 16rpx; background: #fff3d9; color: #75551d; font-size: 24rpx; line-height: 1.7; }
</style>
