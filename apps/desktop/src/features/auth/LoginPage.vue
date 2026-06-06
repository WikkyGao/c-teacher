<script setup lang="ts">
import { useMessage } from "naive-ui";
import { reactive } from "vue";

const emit = defineEmits<{
  login: [teacherName: string];
}>();

const message = useMessage();
const form = reactive({
  teacherName: "王老师"
});

function submitLogin() {
  const teacherName = form.teacherName.trim();
  if (!teacherName) {
    message.warning("请输入教师姓名");
    return;
  }
  emit("login", teacherName);
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div>
        <div class="login-brand">C-teacher</div>
        <h1 class="page-title">教师工作台登录</h1>
        <p class="page-subtitle">进入本机教学管理空间，继续维护学生、资料、课堂记录和提醒。</p>
      </div>

      <n-form label-placement="top" @submit.prevent="submitLogin">
        <n-form-item label="教师姓名">
          <n-input v-model:value="form.teacherName" placeholder="例如：王老师" @keyup.enter="submitLogin" />
        </n-form-item>
        <n-button type="primary" block @click="submitLogin">进入工作台</n-button>
      </n-form>
    </section>
  </main>
</template>
