<template>
  <main class="password-page">
    <el-card class="password-card"
      ><template #header
        ><div>
          <h2>修改登录密码</h2>
          <p>首次登录或安全重置后，需要更新密码才能继续。</p>
        </div></template
      ><el-form ref="formRef" :model="form" :rules="rules" label-position="top"
        ><el-form-item label="当前密码" prop="oldPassword"
          ><el-input
            v-model="form.oldPassword"
            type="password"
            show-password /></el-form-item
        ><el-form-item label="新密码" prop="newPassword"
          ><el-input
            v-model="form.newPassword"
            type="password"
            show-password /></el-form-item
        ><el-form-item label="确认新密码" prop="confirm"
          ><el-input
            v-model="form.confirm"
            type="password"
            show-password /></el-form-item
        ><el-button type="primary" :loading="loading" @click="submit"
          >保存新密码</el-button
        ></el-form
      ></el-card
    >
  </main>
</template>
<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import "element-plus/es/components/message/style/css";
import { api } from "../api";
import { useAuthStore } from "../stores/auth";
const router = useRouter();
const auth = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ oldPassword: "", newPassword: "", confirm: "" });
const rules: FormRules = {
  oldPassword: [{ required: true, message: "请输入当前密码" }],
  newPassword: [
    { required: true, message: "请输入新密码" },
    { min: 8, message: "至少 8 位" },
  ],
  confirm: [
    {
      validator: (_r, v, cb) =>
        v !== form.newPassword ? cb(new Error("两次密码不一致")) : cb(),
    },
  ],
};
async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  loading.value = true;
  try {
    const result = await api.changePassword(form.oldPassword, form.newPassword);
    auth.updatePasswordSession(result.token);
    ElMessage.success("密码已修改");
    router.replace("/dashboard");
  } catch (e: any) {
    ElMessage.error(e.message || "修改失败");
  } finally {
    loading.value = false;
  }
}
</script>
