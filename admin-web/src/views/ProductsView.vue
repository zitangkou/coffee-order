<template>
  <div class="products-page">
    <div class="page-heading">
      <div>
        <h1>商品中心</h1>
        <p>统一维护商品、分类、规格、图片与售罄状态</p>
      </div>
      <el-button
        v-if="auth.isManager && activeTab === 'products'"
        type="primary"
        @click="openProduct()"
      >
        新增商品
      </el-button>
    </div>

    <section class="inventory-summary">
      <div>
        <strong>{{ products.length }}</strong
        ><span>当前商品</span>
      </div>
      <div>
        <strong>{{ activeCount }}</strong
        ><span>正常在售</span>
      </div>
      <div>
        <strong>{{ soldOutCount }}</strong
        ><span>临时售罄</span>
      </div>
      <div>
        <strong>{{ categories.length }}</strong
        ><span>商品分类</span>
      </div>
    </section>

    <article class="panel product-panel">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="商品管理" name="products">
          <div class="product-toolbar">
            <div class="toolbar-filters">
              <el-input
                v-model="filters.keyword"
                clearable
                placeholder="搜索商品名称、风味"
                @keyup.enter="loadProducts"
              />
              <el-select
                v-model="filters.categoryId"
                clearable
                placeholder="全部分类"
              >
                <el-option
                  v-for="category in categories"
                  :key="category.id"
                  :label="category.name"
                  :value="category.id"
                />
              </el-select>
              <el-select
                v-model="filters.status"
                clearable
                placeholder="全部状态"
              >
                <el-option label="正常在售" value="on" />
                <el-option label="临时售罄" value="soldout" />
                <el-option label="已下架" value="off" />
              </el-select>
              <el-button @click="loadProducts">查询</el-button>
            </div>
            <div v-if="auth.isManager && selectedProducts.length" class="batch-actions">
              <span>已选 {{ selectedProducts.length }} 项</span>
              <el-button size="small" @click="batchUpdate({ isActive: true })">批量上架</el-button>
              <el-button size="small" @click="batchUpdate({ isActive: false })">批量下架</el-button>
              <el-button size="small" @click="batchUpdate({ isSoldOut: true })">批量售罄</el-button>
              <el-dropdown @command="batchCategory"><el-button size="small">调整分类</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="category in activeCategories" :key="category.id" :command="category.id">{{ category.name }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
            </div>
          </div>
          <el-table
            v-loading="loading"
            :data="products"
            stripe
            height="calc(100vh - 390px)"
            @selection-change="selectedProducts = $event"
          >
            <el-table-column v-if="auth.isManager" type="selection" width="48" />
            <el-table-column label="商品" min-width="280">
              <template #default="{ row }">
                <div class="product-cell">
                  <div class="product-thumb">
                    <img
                      v-if="row.imageUrl"
                      :src="assetUrl(row.imageUrl)"
                      alt=""
                    />
                    <span v-else>☕</span>
                  </div>
                  <div>
                    <strong>{{ row.name }}</strong
                    ><small>{{
                      row.nameEn || row.description || "暂无英文名与描述"
                    }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="分类" width="130"
              ><template #default="{ row }">{{
                row.category?.name || categoryName(row.categoryId)
              }}</template></el-table-column
            >
            <el-table-column label="价格" width="105"
              ><template #default="{ row }"
                ><strong>¥{{ money(row.price) }}</strong></template
              ></el-table-column
            >
            <el-table-column label="规格" min-width="180"
              ><template #default="{ row }"
                ><span class="spec-summary">{{
                  row.specGroups?.map((item: any) => item.name).join("、") ||
                  "无规格"
                }}</span></template
              ></el-table-column
            >
            <el-table-column label="上架" width="90"
              ><template #default="{ row }"
                ><el-tag :type="row.isActive ? 'success' : 'info'">{{
                  row.isActive ? "已上架" : "已下架"
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="售罄" width="100">
              <template #default="{ row }"
                ><el-switch
                  :model-value="row.isSoldOut"
                  :loading="switchingId === row.id"
                  active-text="是"
                  inactive-text="否"
                  inline-prompt
                  @change="toggleSoldOut(row, $event)"
              /></template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }"
                ><el-button
                  v-if="auth.isManager"
                  link
                  type="primary"
                  @click="openProduct(row)"
                  >编辑</el-button
                ><template v-if="auth.isManager"
                  ><el-button
                    link
                    :disabled="!canReorderProducts || products[0]?.id === row.id"
                    @click="moveProduct(row, -1)"
                    >上移</el-button
                  ><el-button
                    link
                    :disabled="!canReorderProducts || products[products.length - 1]?.id === row.id"
                    @click="moveProduct(row, 1)"
                    >下移</el-button
                  ></template
                ><span v-else class="muted-text">查看</span></template
              >
            </el-table-column>
            <template #empty
              ><el-empty description="没有符合条件的商品"
            /></template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="分类管理" name="categories">
          <div class="tab-actions">
            <p>停用分类不会删除历史商品数据。</p>
            <el-button
              v-if="auth.isManager"
              type="primary"
              @click="openCategory()"
              >新增分类</el-button
            >
          </div>
          <el-table :data="categories" stripe>
            <el-table-column prop="name" label="分类名称" min-width="220" />
            <el-table-column prop="sortOrder" label="排序" width="100" />
            <el-table-column label="商品数" width="110"
              ><template #default="{ row }">{{
                row.products?.length || 0
              }}</template></el-table-column
            >
            <el-table-column label="状态" width="120"
              ><template #default="{ row }"
                ><el-tag :type="row.isActive ? 'success' : 'info'">{{
                  row.isActive ? "启用" : "停用"
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column v-if="auth.isManager" label="操作" width="300"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openCategory(row)"
                  >编辑</el-button
                ><el-button
                  link
                  :disabled="categories[0]?.id === row.id"
                  @click="moveCategory(row, -1)"
                  >上移</el-button
                ><el-button
                  link
                  :disabled="categories[categories.length - 1]?.id === row.id"
                  @click="moveCategory(row, 1)"
                  >下移</el-button
                ><el-button
                  v-if="!row.products?.length"
                  link
                  type="danger"
                  @click="removeCategory(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="规格管理" name="specs">
          <div class="tab-actions">
            <p>被商品使用的规格组不能删除，修改选项会影响后续下单。</p>
            <el-button v-if="auth.isManager" type="primary" @click="openSpec()"
              >新增规格组</el-button
            >
          </div>
          <el-table :data="specGroups" stripe>
            <el-table-column prop="name" label="规格组" min-width="180" />
            <el-table-column label="选择方式" width="120"
              ><template #default="{ row }">{{
                row.type === "MULTI" ? "可多选" : "单选"
              }}</template></el-table-column
            >
            <el-table-column label="规格选项" min-width="320"
              ><template #default="{ row }"
                ><div class="option-tags">
                  <el-tag
                    v-for="option in row.options"
                    :key="option.id || option.label"
                    effect="plain"
                    >{{ option.label
                    }}<template v-if="option.extraPrice">
                      +¥{{ money(option.extraPrice) }}</template
                    ></el-tag
                  >
                </div></template
              ></el-table-column
            >
            <el-table-column label="关联商品" width="110"
              ><template #default="{ row }">{{
                row._count?.products || 0
              }}</template></el-table-column
            >
            <el-table-column v-if="auth.isManager" label="操作" width="180"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openSpec(row)"
                  >编辑</el-button
                ><el-button
                  v-if="!row._count?.products"
                  link
                  type="danger"
                  @click="removeSpec(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </article>

    <el-drawer
      v-model="productDrawer"
      :title="productForm.id ? '编辑商品' : '新增商品'"
      size="620px"
      destroy-on-close
    >
      <el-form
        ref="productFormRef"
        :model="productForm"
        :rules="productRules"
        label-position="top"
        class="drawer-form"
      >
        <div class="form-grid two">
          <el-form-item label="商品名称" prop="name"
            ><el-input v-model.trim="productForm.name" /></el-form-item
          ><el-form-item label="英文名称"
            ><el-input v-model.trim="productForm.nameEn"
          /></el-form-item>
        </div>
        <div class="form-grid three">
          <el-form-item label="分类" prop="categoryId"
            ><el-select v-model="productForm.categoryId" placeholder="选择分类"
              ><el-option
                v-for="category in activeCategories"
                :key="category.id"
                :label="category.name"
                :value="category.id" /></el-select></el-form-item
          ><el-form-item label="基础价格" prop="price"
            ><el-input-number
              v-model="productForm.price"
              :min="0"
              :precision="2"
              :step="1"
              controls-position="right" /></el-form-item
          ><el-form-item label="排序"
            ><el-input-number
              v-model="productForm.sortOrder"
              :min="0"
              controls-position="right"
          /></el-form-item>
        </div>
        <el-form-item label="商品描述"
          ><el-input
            v-model="productForm.description"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
        /></el-form-item>
        <div class="form-grid two">
          <el-form-item label="风味描述"
            ><el-input v-model="productForm.flavorNotes" /></el-form-item
          ><el-form-item label="产地 / 烘焙"
            ><el-input
              v-model="productForm.origin"
              placeholder="例如：埃塞俄比亚 · 浅烘"
          /></el-form-item>
        </div>
        <el-form-item label="关联规格"
          ><el-checkbox-group v-model="selectedSpecIds"
            ><el-checkbox
              v-for="group in specGroups"
              :key="group.id"
              :value="group.id"
              >{{ group.name }}</el-checkbox
            ></el-checkbox-group
          >
          <div v-if="selectedSpecIds.length" class="selected-specs">
            <div v-for="id in selectedSpecIds" :key="id">
              <span>{{ specName(id) }}</span
              ><el-switch
                v-model="specRequired[id]"
                active-text="必选"
                inactive-text="可选"
              />
            </div></div
        ></el-form-item>
        <el-form-item label="商品图片"
          ><div class="image-picker">
            <div class="image-preview">
              <img
                v-if="imagePreview || productForm.imageUrl"
                :src="imagePreview || assetUrl(productForm.imageUrl)"
                alt="商品预览"
              /><span v-else>暂无图片</span>
            </div>
            <div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                @change="selectImage"
              />
              <p>支持 JPG、PNG、WebP，最大 5MB；新商品将在保存后上传。</p>
            </div>
          </div></el-form-item
        >
        <div class="switch-row">
          <el-checkbox v-model="productForm.isSignature">招牌推荐</el-checkbox
          ><el-checkbox v-model="productForm.isHot">热销商品</el-checkbox
          ><el-checkbox v-model="productForm.isActive">上架销售</el-checkbox
          ><el-checkbox v-model="productForm.isSoldOut">临时售罄</el-checkbox>
        </div>
        <el-form-item v-if="productForm.isSoldOut" label="自动恢复时间">
          <el-date-picker v-model="productForm.soldOutUntil" type="datetime" placeholder="留空则手动恢复" clearable />
        </el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="productDrawer = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveProduct"
          >保存商品</el-button
        ></template
      >
    </el-drawer>

    <el-dialog
      v-model="categoryDialog"
      :title="categoryForm.id ? '编辑分类' : '新增分类'"
      width="440px"
    >
      <el-form label-position="top"
        ><el-form-item label="分类名称"
          ><el-input v-model.trim="categoryForm.name" /></el-form-item
        ><el-form-item label="排序"
          ><el-input-number
            v-model="categoryForm.sortOrder"
            :min="0" /></el-form-item
        ><el-form-item v-if="categoryForm.id" label="状态"
          ><el-switch
            v-model="categoryForm.isActive"
            active-text="启用"
            inactive-text="停用" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="categoryDialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveCategory"
          >保存</el-button
        ></template
      >
    </el-dialog>

    <el-dialog
      v-model="specDialog"
      :title="specForm.id ? '编辑规格组' : '新增规格组'"
      width="620px"
    >
      <el-form label-position="top"
        ><div class="form-grid two">
          <el-form-item label="规格组名称"
            ><el-input v-model.trim="specForm.name" /></el-form-item
          ><el-form-item label="选择方式"
            ><el-radio-group v-model="specForm.type"
              ><el-radio-button value="SINGLE">单选</el-radio-button
              ><el-radio-button value="MULTI"
                >多选</el-radio-button
              ></el-radio-group
            ></el-form-item
          >
        </div>
        <el-form-item label="规格选项"
          ><div class="spec-editor">
            <div
              v-for="(option, index) in specForm.options"
              :key="index"
              class="spec-option-row"
            >
              <el-input
                v-model.trim="option.label"
                placeholder="选项名称"
              /><el-input-number
                v-model="option.extraPrice"
                :min="0"
                :precision="2"
                placeholder="加价"
              /><el-checkbox v-model="option.isDefault">默认</el-checkbox
              ><el-button
                link
                type="danger"
                @click="specForm.options.splice(index, 1)"
                >移除</el-button
              >
            </div>
            <el-button plain @click="addSpecOption">＋ 添加选项</el-button>
          </div></el-form-item
        ></el-form
      >
      <template #footer
        ><el-button @click="specDialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveSpec"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from "element-plus";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";
import type { Category, Product, SpecGroup } from "../types";

const auth = useAuthStore();
const activeTab = ref("products");
const loading = ref(false);
const saving = ref(false);
const switchingId = ref<number>();
const products = ref<Product[]>([]);
const selectedProducts = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const specGroups = ref<SpecGroup[]>([]);
const filters = reactive<{
  keyword: string;
  categoryId?: number;
  status: string;
}>({ keyword: "", categoryId: undefined, status: "" });
const activeCount = computed(
  () =>
    products.value.filter((item) => item.isActive && !item.isSoldOut).length,
);
const soldOutCount = computed(
  () => products.value.filter((item) => item.isSoldOut).length,
);
const activeCategories = computed(() =>
  categories.value.filter((item) => item.isActive),
);
const canReorderProducts = computed(
  () => !filters.keyword && !filters.categoryId && !filters.status,
);
const productDrawer = ref(false);
const productFormRef = ref<FormInstance>();
const selectedImage = ref<File>();
const imagePreview = ref("");
const emptyProduct = () => ({
  id: 0,
  name: "",
  nameEn: "",
  categoryId: undefined as number | undefined,
  price: 0,
  description: "",
  flavorNotes: "",
  origin: "",
  imageUrl: "",
  sortOrder: 0,
  isSignature: false,
  isHot: false,
  isActive: true,
  isSoldOut: false,
  soldOutUntil: null as Date | string | null,
});
const productForm = reactive(emptyProduct());
const selectedSpecIds = ref<number[]>([]);
const specRequired = reactive<Record<number, boolean>>({});
const productRules: FormRules = {
  name: [{ required: true, message: "请输入商品名称", trigger: "blur" }],
  categoryId: [{ required: true, message: "请选择分类", trigger: "change" }],
  price: [{ required: true, message: "请输入价格", trigger: "change" }],
};
const categoryDialog = ref(false);
const categoryForm = reactive({
  id: 0,
  name: "",
  sortOrder: 0,
  isActive: true,
});
const specDialog = ref(false);
const specForm = reactive<{
  id: number;
  name: string;
  type: "SINGLE" | "MULTI";
  sortOrder: number;
  options: Array<{ label: string; extraPrice: number; isDefault: boolean }>;
}>({ id: 0, name: "", type: "SINGLE", sortOrder: 0, options: [] });
function money(value: unknown) {
  return Number(value || 0).toFixed(2);
}
function assetUrl(path?: string | null) {
  return path || "";
}
function categoryName(id: number) {
  return categories.value.find((item) => item.id === id)?.name || "未分类";
}
function specName(id: number) {
  return specGroups.value.find((item) => item.id === id)?.name || "未知规格";
}
async function loadProducts() {
  loading.value = true;
  try {
    products.value = await api.products(filters);
  } catch (error: any) {
    ElMessage.error(error.message || "商品加载失败");
  } finally {
    loading.value = false;
  }
}
async function loadReference() {
  try {
    [categories.value, specGroups.value] = await Promise.all([
      api.categories(),
      api.specGroups(),
    ]);
  } catch (error: any) {
    ElMessage.error(error.message || "基础数据加载失败");
  }
}
function openProduct(value?: unknown) {
  const product = value as Product | undefined;
  Object.assign(
    productForm,
    emptyProduct(),
    product ? { ...product, price: Number(product.price) } : {},
  );
  selectedSpecIds.value = product?.specGroups?.map((item) => item.id) || [];
  for (const key of Object.keys(specRequired)) delete specRequired[Number(key)];
  for (const group of product?.specGroups || [])
    specRequired[group.id] = group.required !== false;
  selectedImage.value = undefined;
  imagePreview.value = "";
  productDrawer.value = true;
}
function selectImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning("图片不能超过 5MB");
    return;
  }
  selectedImage.value = file;
  imagePreview.value = URL.createObjectURL(file);
}
async function saveProduct() {
  if (!(await productFormRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const payload = {
      name: productForm.name,
      nameEn: productForm.nameEn,
      categoryId: productForm.categoryId,
      price: productForm.price,
      description: productForm.description,
      flavorNotes: productForm.flavorNotes,
      origin: productForm.origin,
      sortOrder: productForm.sortOrder,
      isSignature: productForm.isSignature,
      isHot: productForm.isHot,
      isActive: productForm.isActive,
      isSoldOut: productForm.isSoldOut,
      soldOutUntil: productForm.soldOutUntil
        ? new Date(productForm.soldOutUntil).toISOString()
        : null,
      specGroupIds: selectedSpecIds.value.map((id) => ({
        specGroupId: id,
        required: specRequired[id] !== false,
      })),
    };
    const saved = productForm.id
      ? await api.updateProduct(productForm.id, payload)
      : await api.createProduct(payload);
    if (selectedImage.value)
      await api.uploadProductImage(saved.id, selectedImage.value);
    ElMessage.success("商品已保存");
    productDrawer.value = false;
    await Promise.all([loadProducts(), loadReference()]);
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
async function toggleSoldOut(value: unknown, soldOut: unknown) {
  const product = value as Product;
  switchingId.value = product.id;
  try {
    await api.setSoldOut(product.id, Boolean(soldOut));
    product.isSoldOut = Boolean(soldOut);
    ElMessage.success(product.isSoldOut ? "已标记售罄" : "已恢复在售");
  } catch (error: any) {
    ElMessage.error(error.message || "操作失败");
  } finally {
    switchingId.value = undefined;
  }
}
async function batchUpdate(data: Record<string, unknown>) {
  try {
    await api.batchUpdateProducts(selectedProducts.value.map((item) => item.id), data);
    ElMessage.success("商品已批量更新");
    await loadProducts();
  } catch (error: any) {
    ElMessage.error(error.message || "批量操作失败");
  }
}
function batchCategory(command: string | number) {
  batchUpdate({ categoryId: Number(command) });
}
async function moveProduct(value: unknown, direction: -1 | 1) {
  if (!canReorderProducts.value)
    return ElMessage.warning("请先清空筛选条件再调整全局顺序");
  const product = value as Product;
  const index = products.value.findIndex((item) => item.id === product.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= products.value.length) return;
  const next = [...products.value];
  [next[index], next[target]] = [next[target], next[index]];
  try {
    await api.reorderProducts(next.map((item) => item.id));
    products.value = next;
    ElMessage.success("商品排序已保存");
  } catch (error: any) {
    ElMessage.error(error.message || "排序保存失败");
  }
}
function openCategory(value?: unknown) {
  const category = value as Category | undefined;
  Object.assign(categoryForm, {
    id: category?.id || 0,
    name: category?.name || "",
    sortOrder: category?.sortOrder || 0,
    isActive: category?.isActive !== false,
  });
  categoryDialog.value = true;
}
async function saveCategory() {
  if (!categoryForm.name) return ElMessage.warning("请输入分类名称");
  saving.value = true;
  try {
    categoryForm.id
      ? await api.updateCategory(categoryForm.id, categoryForm)
      : await api.createCategory(categoryForm);
    ElMessage.success("分类已保存");
    categoryDialog.value = false;
    await Promise.all([loadReference(), loadProducts()]);
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
async function removeCategory(value: unknown) {
  const category = value as Category;
  try {
    await ElMessageBox.confirm(
      `确认删除空分类“${category.name}”？`,
      "删除分类",
      { type: "warning" },
    );
    await api.deleteCategory(category.id);
    ElMessage.success("分类已删除");
    await loadReference();
  } catch (error: any) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(error.message || "删除失败");
  }
}
async function moveCategory(value: unknown, direction: -1 | 1) {
  const category = value as Category;
  const index = categories.value.findIndex((item) => item.id === category.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= categories.value.length) return;
  const next = [...categories.value];
  [next[index], next[target]] = [next[target], next[index]];
  try {
    await api.reorderCategories(next.map((item) => item.id));
    categories.value = next;
    ElMessage.success("分类排序已保存");
  } catch (error: any) {
    ElMessage.error(error.message || "排序保存失败");
  }
}
function openSpec(value?: unknown) {
  const group = value as SpecGroup | undefined;
  Object.assign(specForm, {
    id: group?.id || 0,
    name: group?.name || "",
    type: group?.type || "SINGLE",
    sortOrder: group?.sortOrder || 0,
    options: (group?.options || []).map((item) => ({
      label: item.label,
      extraPrice: Number(item.extraPrice),
      isDefault: item.isDefault,
    })),
  });
  if (!specForm.options.length) addSpecOption();
  specDialog.value = true;
}
function addSpecOption() {
  specForm.options.push({ label: "", extraPrice: 0, isDefault: false });
}
async function saveSpec() {
  if (!specForm.name) return ElMessage.warning("请输入规格组名称");
  if (!specForm.options.some((item) => item.label))
    return ElMessage.warning("至少添加一个规格选项");
  saving.value = true;
  try {
    const payload = {
      name: specForm.name,
      type: specForm.type,
      sortOrder: specForm.sortOrder,
      options: specForm.options.filter((item) => item.label),
    };
    specForm.id
      ? await api.updateSpecGroup(specForm.id, payload)
      : await api.createSpecGroup(payload);
    ElMessage.success("规格组已保存");
    specDialog.value = false;
    await loadReference();
  } catch (error: any) {
    ElMessage.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
}
async function removeSpec(value: unknown) {
  const group = value as SpecGroup;
  try {
    await ElMessageBox.confirm(
      `确认删除规格组“${group.name}”？`,
      "删除规格组",
      { type: "warning" },
    );
    await api.deleteSpecGroup(group.id);
    ElMessage.success("规格组已删除");
    await loadReference();
  } catch (error: any) {
    if (error !== "cancel" && error !== "close")
      ElMessage.error(error.message || "删除失败");
  }
}
onMounted(async () => {
  await loadReference();
  await loadProducts();
});
</script>
