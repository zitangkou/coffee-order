<template>
  <main class="login-page">
    <section class="login-story">
      <div class="story-content">
        <div class="story-mark">COFFEE OS</div>
        <h1>让每一杯咖啡<br />都有清晰的节奏</h1>
        <p>订单、商品和经营数据集中管理，为门店日常运营提供可靠视图。</p>
        <div class="story-footer">NAGA COFFEE · STORE OPERATIONS</div>
      </div>
    </section>
    <section class="login-panel">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        label-position="top"
        @submit.prevent="submit"
      >
        <div class="eyebrow">MANAGEMENT CONSOLE</div>
        <h2>欢迎回来</h2>
        <p class="login-subtitle">登录 Coffee OS 门店管理中心</p>
        <el-form-item label="用户名" prop="username"
          ><el-input
            v-model.trim="form.username"
            size="large"
            autocomplete="username"
            placeholder="请输入管理员用户名"
        /></el-form-item>
        <el-form-item label="密码" prop="password"
          ><el-input
            v-model="form.password"
            size="large"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="请输入密码"
            @keyup.enter="submit"
        /></el-form-item>
        <el-button
          type="primary"
          size="large"
          native-type="submit"
          :loading="loading"
          class="login-submit"
          >登录管理中心</el-button
        >
        <p class="security-note">仅限授权员工使用 · 操作将记录安全审计</p>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import "element-plus/es/components/message/style/css";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ username: "", password: "" });
const rules: FormRules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};
async function submit() {
  if (!(await formRef.value?.validate().catch(() => false)) || loading.value)
    return;
  loading.value = true;
  try {
    const result = await api.login(form.username, form.password);
    auth.setSession(result.token, result.admin);
    ElMessage.success("登录成功");
    await router.replace(
      result.admin.mustChangePassword
        ? "/change-password"
        : String(route.query.redirect || "/dashboard"),
    );
  } catch (error: any) {
    ElMessage.error(error.message || "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>
