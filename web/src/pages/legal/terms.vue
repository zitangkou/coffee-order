<template>
  <view class="legal-page">
    <view class="title">Coffee OS 用户服务协议</view>
    <view class="meta">更新日期：2026 年 8 月 29 日</view>

    <view class="section">
      <view class="heading">服务提供者</view>
      <view class="paragraph">本服务由 {{ LEGAL_OPERATOR_NAME }} 提供，经营地址为 {{ LEGAL_STORE_ADDRESS }}。客服及售后联系方式：{{ LEGAL_CUSTOMER_SERVICE }}。</view>
    </view>

    <view class="section">
      <view class="heading">服务内容</view>
      <view class="paragraph">本服务用于浏览店铺菜单、选择商品规格、提交堂食或外带订单、完成支付、查看制作进度及申请售后。实际商品、价格、营业时间和可售状态以提交订单时页面展示为准。</view>
    </view>
    <view class="section">
      <view class="heading">订单与支付</view>
      <view class="paragraph">订单需经支付渠道确认成功后生效。因网络延迟导致页面状态暂未更新时，请勿重复付款，可稍后在订单列表查看或联系店铺核对。</view>
    </view>
    <view class="section">
      <view class="heading">退款与售后</view>
      <view class="paragraph">未支付订单可在订单详情主动取消。已支付订单可从详情页提交退款申请，店铺将结合制作状态、商品情况和实际履约结果处理。审核同意后原路退款；审核通过不代表资金即时到账，实际到账时间以支付渠道处理结果为准。如对处理结果有异议，可通过上述客服渠道协商。</view>
    </view>
    <view class="section">
      <view class="heading">用户责任</view>
      <view class="paragraph">请提供真实、准确的桌号、取餐核对信息和订单备注，不得利用接口漏洞、重复请求或其他方式干扰正常经营和支付秩序。</view>
    </view>
    <view class="section">
      <view class="heading">服务变更</view>
      <view class="paragraph">店铺可因售罄、设备维护、网络异常或停止营业暂时调整服务。已经支付的订单仍将按照实际履约或售后结果处理。</view>
    </view>
    <view class="notice">提交订单即表示你已阅读并同意本协议。服务争议优先通过客服联系渠道协商；协商不成的，按适用法律法规处理。</view>
  </view>
</template>

<script setup lang="ts">
import {
  LEGAL_CUSTOMER_SERVICE,
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
