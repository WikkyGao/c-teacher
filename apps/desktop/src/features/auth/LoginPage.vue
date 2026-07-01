<script setup lang="ts">
import { useMessage } from "naive-ui";
import { reactive, ref } from "vue";
import type { UserRole } from "./authSession";

const emit = defineEmits<{
  login: [userName: string, role: UserRole];
}>();

const message = useMessage();
const activeRole = ref<UserRole>("teacher");
const form = reactive({
  userName: "王老师",
  parentName: "张爸爸"
});

const roleOptions = [
  { label: "教师", value: "teacher" as UserRole, desc: "管理学生、备课、批改、查看全部数据" },
  { label: "家长", value: "parent" as UserRole, desc: "只读查看孩子学习进度、错题、报告" }
];

function submitLogin() {
  const name = (activeRole.value === "teacher" ? form.userName : form.parentName).trim();
  if (!name) {
    message.warning(activeRole.value === "teacher" ? "请输入教师姓名" : "请输入家长姓名");
    return;
  }
  emit("login", name, activeRole.value);
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-header">
        <div class="login-brand">C-teacher</div>
        <h1 class="page-title">欢迎回来</h1>
        <p class="page-subtitle">选择您的身份开始使用</p>
      </div>

      <div class="role-selector">
        <button
          v-for="opt in roleOptions"
          :key="opt.value"
          class="role-card"
          :class="{ active: activeRole === opt.value }"
          type="button"
          @click="activeRole = opt.value"
        >
          <span class="role-label">{{ opt.label }}</span>
          <span class="role-desc">{{ opt.desc }}</span>
        </button>
      </div>

      <n-form label-placement="top" @submit.prevent="submitLogin">
        <template v-if="activeRole === 'teacher'">
          <n-form-item label="教师姓名">
            <n-input v-model:value="form.userName" placeholder="例如：王老师" @keyup.enter="submitLogin" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item label="家长姓名">
            <n-input v-model:value="form.parentName" placeholder="例如：张爸爸" @keyup.enter="submitLogin" />
          </n-form-item>
        </template>

        <!-- 始终占位，visibility 切换，防止高度跳动 -->
        <div class="login-hint-area" :class="{ visible: activeRole === 'parent' }">
          <p class="login-hint">家长仅可查看数据，不可编辑。需由教师发送分享包导入孩子数据。</p>
        </div>

        <n-button type="primary" block @click="submitLogin">
          {{ activeRole === 'teacher' ? '进入教师工作台' : '进入家长视图' }}
        </n-button>
      </n-form>
    </section>
  </main>
</template>

<style scoped>
.login-header {
  margin-bottom: 4px;
}

.login-brand {
  width: fit-content;
  margin-bottom: 14px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--primary) 24%, var(--border));
  border-radius: var(--radius-md);
  color: var(--primary-strong);
  background: var(--primary-soft);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.role-selector {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.role-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel-solid);
  min-height: 64px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
}

.role-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.role-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
}

.role-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.role-desc {
  font-size: 12px;
  color: var(--muted-strong);
  line-height: 1.4;
}

/* 始终占位，仅家长角色时显示内容 */
.login-hint-area {
  min-height: 36px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  visibility: hidden;
}

.login-hint-area.visible {
  visibility: visible;
}

.login-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
