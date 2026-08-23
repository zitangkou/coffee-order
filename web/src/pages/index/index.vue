<template>
  <view class="page home">
    <view class="hero">
      <view class="hero-line">
        <view class="hero-name">{{ shop?.name || "Coffee OS" }}</view>
        <view v-if="shop?.businessHours" class="hero-hours">{{ shop.businessHours }}</view>
      </view>
      <view v-if="shop?.slogan" class="hero-slogan">{{ shop.slogan }}</view>
      <view class="mode-switch">
        <view
          class="mode"
          :class="user.orderType === 'DINE_IN' ? 'mode-active' : ''"
          @tap="onModeTap('DINE_IN')"
        >
          堂食{{ user.tableNo ? " · " + user.tableNo : "" }}<text class="mode-arrow">▾</text>
        </view>
        <view
          class="mode"
          :class="user.orderType === 'TAKEOUT' ? 'mode-active' : ''"
          @tap="onModeTap('TAKEOUT')"
        >
          外带
        </view>
      </view>
    </view>

    <!-- 吸顶分类条：全部 + 快捷筛选 + 全部分类，锚点联动 -->
    <scroll-view
      scroll-x
      class="cats"
      :show-scrollbar="false"
      :scroll-into-view="'chip-' + activeKey"
    >
      <view
        v-for="chip in chips"
        :key="chip.key"
        :id="'chip-' + chip.key"
        class="cat"
        :class="activeKey === chip.key ? 'cat-active' : ''"
        @tap="onChipTap(chip.key)"
      >
        {{ chip.label }}<text v-if="chip.key !== 'all'" class="cat-num">{{ chip.count }}</text>
      </view>
    </scroll-view>

    <!-- 分组菜单：招牌/热销 + 各分类分区，滚动联动高亮分类 -->
    <view class="menu">
      <view v-for="s in sections" :key="s.key" class="section">
        <view class="section-head">
          <view class="section-mark"></view>
          <text class="section-name">{{ s.name }}</text>
          <text class="section-count">{{ s.products.length }}款</text>
        </view>
        <view class="products">
          <view
            v-for="p in soldOutLast(s.products)"
            :key="s.key + '-' + p.id"
            class="product card"
            :class="p.isSoldOut ? 'p-soldout' : ''"
            @tap="openSpecSheet(p)"
          >
            <view class="p-img">
              <image v-if="p.imageUrl" :src="p.imageUrl" mode="aspectFill" class="p-img-img" />
              <text v-else class="p-img-text">{{ p.name.slice(0, 1) }}</text>
              <view v-if="p.isSoldOut" class="sold-out">售罄</view>
              <view class="badges">
                <text v-if="p.isSignature" class="badge badge-accent">招牌</text>
                <text v-if="p.isHot" class="badge badge-warning">热销</text>
              </view>
            </view>
            <view class="p-info">
              <!-- 商品名是详情页的次级入口；整卡点击走规格弹层 -->
              <view class="p-name" @tap.stop="goDetail(p.id)">
                {{ p.name }}
                <text v-if="p.nameEn" class="p-en">{{ p.nameEn }}</text>
              </view>
              <view v-if="p.flavorNotes" class="p-notes">{{ p.flavorNotes }}</view>
              <view class="p-bottom">
                <text class="price">¥{{ p.price }}</text>
                <view class="add-btn" @tap.stop="openSpecSheet(p)">＋</view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!sections.length" class="empty">菜单准备中，敬请期待</view>
    </view>

    <view class="member-entry" @tap="goMember">我的咖啡档案</view>
    <!-- #ifdef H5 -->
    <view class="admin-entry" @tap="goAdmin">商家后台</view>
    <!-- #endif -->

    <view v-if="cart.count > 0" class="cart-bar">
      <view class="cart-info" @tap="goCart">
        <view class="cart-count">{{ cart.count }}</view>
        <text class="cart-total">¥{{ cart.total }}</text>
      </view>
      <view class="cart-btn" @tap="goCheckout">去结算</view>
    </view>

    <!-- 选桌浮层 -->
    <view v-if="showTablePicker" class="mask" @tap="showTablePicker = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">选择桌号</view>
        <view class="table-grid">
          <view
            v-for="t in tables"
            :key="t.id"
            class="table-item"
            :class="user.tableId === t.id ? 'table-active' : ''"
            @tap="pickTable(t)"
          >
            {{ t.tableNo }}
          </view>
        </view>
      </view>
    </view>

    <SpecSheet v-model:show="showSpecSheet" :product="activeProduct" @add="onAddToCart" />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from "vue";
import { onLoad, onPageScroll, onShow } from "@dcloudio/uni-app";
import { api } from "../../api";
import { useCartStore } from "../../stores/cart";
import { useUserStore } from "../../stores/user";
import { applyTableId } from "../../utils/table";
import SpecSheet from "../../components/SpecSheet.vue";
import type { Category, Product, Shop, Table } from "../../types";

type TabKey = "all" | "signature" | "hot" | number;

interface Section {
  key: TabKey;
  name: string;
  products: Product[];
}

const user = useUserStore();
const cart = useCartStore();
const categories = ref<Category[]>([]);
const shop = ref<Shop | null>(null);
const tables = ref<Table[]>([]);
const activeKey = ref<TabKey>("all");
const showTablePicker = ref(false);
const activeProduct = ref<Product | null>(null);
const showSpecSheet = ref(false);

const allProducts = computed(() => categories.value.flatMap((c) => c.products));
const signatureProducts = computed(() => allProducts.value.filter((p) => p.isSignature));
const hotProducts = computed(() => allProducts.value.filter((p) => p.isHot));
const visibleCats = computed(() => categories.value.filter((c) => c.products.length > 0));

const sections = computed<Section[]>(() => {
  const list: Section[] = [];
  if (signatureProducts.value.length) {
    list.push({ key: "signature", name: "招牌推荐", products: signatureProducts.value });
  }
  if (hotProducts.value.length) {
    list.push({ key: "hot", name: "热销榜单", products: hotProducts.value });
  }
  for (const c of visibleCats.value) {
    list.push({ key: c.id, name: c.name, products: c.products });
  }
  return list;
});

const chips = computed(() => [
  { key: "all" as TabKey, label: "全部", count: allProducts.value.length },
  ...(signatureProducts.value.length
    ? [{ key: "signature" as TabKey, label: "招牌", count: signatureProducts.value.length }]
    : []),
  ...(hotProducts.value.length
    ? [{ key: "hot" as TabKey, label: "热销", count: hotProducts.value.length }]
    : []),
  ...visibleCats.value.map((c) => ({ key: c.id as TabKey, label: c.name, count: c.products.length })),
]);

/* ---------------- 锚点定位与滚动联动 ---------------- */

const barHeight = ref(44);
const offsets = ref<{ key: TabKey; top: number }[]>([]);
let lockUntil = 0;
let spyTimer: ReturnType<typeof setTimeout> | null = null;
let latestScrollTop = 0;

function measureSections() {
  const instance = getCurrentInstance();
  const query = uni.createSelectorQuery().in(instance ? instance.proxy : undefined);
  query.select(".cats").boundingClientRect();
  query.selectAll(".section").boundingClientRect();
  // 类型声明仅覆盖 scrollOffset 的回调形式；无参调用运行时受支持，结果由 exec 统一收集
  (query.selectViewport() as any).scrollOffset();
  query.exec((res: any[]) => {
    const barRect = res?.[0];
    const sectionRects: any[] = res?.[1] || [];
    const scrollTop = res?.[2]?.scrollTop || 0;
    if (barRect?.height) barHeight.value = barRect.height;
    offsets.value = sections.value.map((s, i) => ({
      key: s.key,
      top: (sectionRects[i]?.top ?? 0) + scrollTop,
    }));
  });
}

watch(categories, () => {
  nextTick(() => measureSections());
});

function updateActive(scrollTop: number) {
  const list = offsets.value;
  if (!list.length) return;
  const threshold = barHeight.value + 16;
  if (scrollTop < list[0].top - threshold) {
    activeKey.value = "all";
    return;
  }
  let current: TabKey = list[0].key;
  for (const item of list) {
    if (item.top - threshold <= scrollTop) current = item.key;
  }
  activeKey.value = current;
}

onPageScroll((e) => {
  latestScrollTop = e.scrollTop;
  if (Date.now() < lockUntil || spyTimer) return;
  spyTimer = setTimeout(() => {
    spyTimer = null;
    if (Date.now() >= lockUntil) updateActive(latestScrollTop);
  }, 60);
});

function onChipTap(key: TabKey) {
  activeKey.value = key;
  lockUntil = Date.now() + 600;
  if (key === "all") {
    uni.pageScrollTo({ scrollTop: 0, duration: 300 });
    return;
  }
  const target = offsets.value.find((o) => o.key === key);
  if (!target) return;
  uni.pageScrollTo({
    scrollTop: Math.max(0, target.top - barHeight.value - 12),
    duration: 300,
  });
}

/* ---------------- 数据与业务 ---------------- */

function soldOutLast(list: Product[]) {
  return [...list].sort((a, b) => Number(a.isSoldOut) - Number(b.isSoldOut));
}

onLoad(async (options) => {
  try {
    await user.ensureLogin();
    await applyTableId((options as any)?.table_id);
    loadData();
  } catch (e: any) {
    uni.showToast({ title: `启动失败：${e.message || "未知错误"}`, icon: "none", duration: 5000 });
  }
});

onShow(() => {
  loadData();
});

async function loadData() {
  try {
    const [cats, s, ts] = await Promise.all([api.getCategories(), api.getShop(), api.getTables()]);
    categories.value = cats;
    shop.value = s;
    tables.value = ts;
  } catch (e: any) {
    uni.showToast({ title: e.message || "加载失败", icon: "none" });
  }
}

function onModeTap(type: "DINE_IN" | "TAKEOUT") {
  if (type === "TAKEOUT") {
    user.setOrderType("TAKEOUT");
    return;
  }
  user.setOrderType("DINE_IN");
  if (!user.tableId) {
    showTablePicker.value = true;
  } else if (type === user.orderType) {
    showTablePicker.value = true;
  }
}

function pickTable(t: Table) {
  user.setTable(t);
  showTablePicker.value = false;
}

function openSpecSheet(p: Product) {
  activeProduct.value = p;
  showSpecSheet.value = true;
}

function onAddToCart(payload: {
  product: Product;
  specs: Record<string, string | string[]>;
  quantity: number;
  remark: string;
  unitPrice: number;
}) {
  cart.add({
    productId: payload.product.id,
    name: payload.product.name,
    image: payload.product.imageUrl,
    specs: payload.specs,
    unitPrice: payload.unitPrice,
    quantity: payload.quantity,
  });
  if (payload.remark) cart.remark = payload.remark;
  showSpecSheet.value = false;
  uni.showToast({ title: "已加入购物车", icon: "success" });
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
}

function goCart() {
  uni.navigateTo({ url: "/pages/cart/index" });
}

function goCheckout() {
  if (!cart.count) {
    uni.showToast({ title: "购物车是空的", icon: "none" });
    return;
  }
  uni.navigateTo({ url: "/pages/order/create" });
}

// #ifdef H5
function goAdmin() {
  uni.navigateTo({ url: "/pages_admin/login/index" });
}
// #endif

function goMember() {
  uni.navigateTo({ url: "/pages/member/index" });
}
</script>

<style lang="scss" scoped>
.home {
  padding-bottom: 160rpx;
}

/* 紧凑头部：品牌一行、切换一行，把首屏让给菜单 */
.hero {
  background: linear-gradient(160deg, #2f2a26 0%, #4a3d31 100%);
  color: #fff;
  border-radius: 16px;
  padding: 24rpx 28rpx 20rpx;
  margin-top: 8rpx;
}

.hero-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}

.hero-name {
  font-size: 32rpx;
  font-weight: 800;
}

.hero-hours {
  color: #a99a86;
  font-size: 22rpx;
  flex-shrink: 0;
}

.hero-slogan {
  margin-top: 4rpx;
  color: #d8c9b6;
  font-size: 22rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-switch {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.mode {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 10rpx 28rpx;
  font-size: 24rpx;
  color: #d8d0c6;
}

.mode-active {
  background: #c4a484;
  color: #fff;
  font-weight: 600;
}

.mode-arrow {
  margin-left: 8rpx;
  font-size: 20rpx;
}

/* 吸顶分类条 */
.cats {
  position: sticky;
  top: 0;
  z-index: 60;
  white-space: nowrap;
  margin: 16rpx -24rpx 0;
  padding: 20rpx 24rpx;
  background: #f7f4f0;
  box-shadow: 0 6rpx 12rpx rgba(47, 42, 38, 0.05);
}

.cat {
  display: inline-block;
  padding: 14rpx 30rpx;
  margin-right: 16rpx;
  background: #fff;
  border: 1px solid #e8e2db;
  border-radius: 32px;
  color: #6b625b;
  font-size: 26rpx;
}

.cat-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
  font-weight: 600;
}

.cat-num {
  margin-left: 8rpx;
  font-size: 20rpx;
  opacity: 0.7;
}

/* 分区标题 */
.section-head {
  display: flex;
  align-items: center;
  margin: 32rpx 0 20rpx;
}

.section-mark {
  width: 8rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #c4a484;
  margin-right: 12rpx;
}

.section-name {
  font-size: 30rpx;
  font-weight: 700;
}

.section-count {
  margin-left: 12rpx;
  color: #b9b0a6;
  font-size: 22rpx;
}

.products {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.product {
  width: 48.5%;
  padding: 16rpx;
  box-sizing: border-box;
}

.p-soldout {
  opacity: 0.55;
}

.p-img {
  height: 260rpx;
  border-radius: 12px;
  background: linear-gradient(150deg, #efe6da, #d9c9b4);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.p-img-img {
  width: 100%;
  height: 100%;
}

.p-img-text {
  font-size: 72rpx;
  color: #8a7158;
  font-weight: 700;
}

.sold-out {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  text-align: center;
  font-size: 22rpx;
  padding: 6rpx 0;
}

.badges {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  display: flex;
  gap: 8rpx;
}

.p-name {
  font-size: 28rpx;
  font-weight: 600;
  margin-top: 12rpx;
}

.p-en {
  font-size: 20rpx;
  color: #b9b0a6;
  font-weight: 400;
  margin-left: 8rpx;
}

.p-notes {
  color: #6b625b;
  font-size: 22rpx;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.add-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #2f2a26;
  color: #fff;
  text-align: center;
  line-height: 52rpx;
  font-size: 36rpx;
}

.admin-entry {
  text-align: center;
  color: #b9b0a6;
  font-size: 22rpx;
  margin: 32rpx 0 8rpx;
  text-decoration: underline;
}

.member-entry {
  text-align: center;
  color: #6b4f2f;
  font-size: 24rpx;
  font-weight: 600;
  margin: 32rpx 0 0;
}

.cart-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  background: #2f2a26;
  border-radius: 24px;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx 0 28rpx;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.cart-info {
  display: flex;
  align-items: center;
  color: #fff;
}

.cart-count {
  background: #c4a484;
  border-radius: 50%;
  min-width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  text-align: center;
  font-size: 22rpx;
  margin-right: 16rpx;
  padding: 0 8rpx;
}

.cart-total {
  font-size: 32rpx;
  font-weight: 700;
}

.cart-btn {
  background: #c4a484;
  color: #fff;
  border-radius: 24px;
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 40rpx;
  font-weight: 600;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  display: flex;
  align-items: flex-end;
}

.sheet {
  background: #fff;
  width: 100%;
  border-radius: 24px 24px 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  max-height: 70vh;
}

.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.table-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.table-item {
  width: 150rpx;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 12px;
  border: 1px solid #e0d8cd;
  font-size: 28rpx;
}

.table-active {
  background: #2f2a26;
  color: #fff;
  border-color: #2f2a26;
}
</style>
