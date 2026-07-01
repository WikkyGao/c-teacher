<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Plus } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { UserRole } from "../auth/authSession";
import { useChildStore } from "../children/childStore";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import { childLabel } from "../../shared/utils/childLabel";

const props = defineProps<{ userRole?: UserRole }>();

const cl = computed(() => childLabel(props.userRole));

const workspace = useChildStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const showCompleted = ref(false);
const form = reactive({
  studentId: workspace.activeChildId,
  title: "陈一诺数学课",
  relatedType: "课程" as "课程" | "作业" | "批改" | "报告",
  remindAt: Date.now() + 60 * 60 * 1000
});
const childOptions = computed(() => {
  return workspace.items.map((child) => ({ label: child.name, value: child.id }));
});
const typeOptions = ["课程", "作业", "批改", "报告"].map((item) => ({ label: item, value: item }));

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function studentName(studentId: string) {
  return workspace.items.find((child) => child.id === studentId)?.name ?? studentId;
}

async function notify(title: string) {
  if (!isTauri()) return false;
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title: "C-teacher 提醒", body: title });
    return true;
  }
  return false;
}

async function createNativeReminder() {
  if (!isTauri()) return false;
  await invoke("create_system_reminder", {
    request: {
      title: form.title.trim(),
      studentName: studentName(form.studentId),
      relatedType: form.relatedType,
      remindAt: form.remindAt
    }
  });
  return true;
}

async function createReminder() {
  if (!form.studentId || !form.title.trim() || !form.remindAt) {
    message.warning("请补全提醒信息");
    return;
  }
  let systemReminderCreated = false;
  try {
    systemReminderCreated = await createNativeReminder();
  } catch (error) {
    message.error(`系统提醒创建失败：${String(error)}`);
  }
  workspace.createReminder({
    studentId: form.studentId,
    title: form.title.trim(),
    remindAt: form.remindAt,
    relatedType: form.relatedType
  });
  const notified = await notify(form.title.trim());
  if (systemReminderCreated) {
    message.success(notified ? "系统提醒已写入提醒事项，并发送测试通知" : "系统提醒已写入提醒事项");
  } else {
    message.success(notified ? "应用内提醒已创建，并发送测试通知" : "应用内提醒已创建");
  }
}

function removeReminder(reminderId: string) {
  confirmDelete({
    content: "确定要删除这个提醒吗？",
    onOk: () => {
      const deleted = workspace.deleteReminder(reminderId);
      if (deleted) {
        message.success("应用内提醒已删除；如已写入系统提醒事项，请在提醒事项 App 中同步处理");
      }
    }
  });
}

function completeReminder(reminderId: string) {
  const completed = workspace.completeReminder(reminderId);
  message[completed ? "success" : "warning"](completed ? "提醒已完成" : "提醒不存在或已完成");
}

function undoCompleteReminder(reminderId: string) {
  const undone = workspace.undoCompleteReminder(reminderId);
  message[undone ? "success" : "warning"](undone ? "已撤回完成状态" : "提醒不存在或未完成");
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">提醒设置</h1>
        <p class="page-subtitle">创建课程、作业、批改和报告提醒</p>
      </div>
      <div class="reminder-page-count" :class="{ active: workspace.incompleteReminders.length > 0 }">
        <i></i>
        <strong>{{ workspace.incompleteReminders.length }}</strong>
        <span>未完成提醒</span>
      </div>
    </div>

    <div class="dashboard-grid">
      <section class="side-panel wide-panel">
        <h2>未完成提醒</h2>
        <div v-if="workspace.sortedReminders.length === 0" class="muted-text">暂无未完成提醒</div>
        <div v-for="reminder in workspace.sortedReminders" :key="reminder.id" class="list-row compact-row reminder-row">
          <strong>{{ formatTime(reminder.remindAt) }} · {{ reminder.title }}</strong>
          <p>{{ studentName(reminder.studentId) }} · {{ reminder.relatedType }} · 未完成</p>
          <n-space>
            <n-button size="small" secondary @click="completeReminder(reminder.id)">已完成</n-button>
            <n-button v-if="props.userRole !== 'parent'" size="small" secondary type="error" @click="removeReminder(reminder.id)">删除</n-button>
          </n-space>
        </div>

        <button class="completed-toggle" type="button" @click="showCompleted = !showCompleted">
          已完成提醒 {{ workspace.completedReminders.length }} 条
          <span>{{ showCompleted ? "收起" : "展开" }}</span>
        </button>
        <div v-if="showCompleted" class="completed-reminder-list">
          <div v-if="workspace.completedReminders.length === 0" class="muted-text">暂无已完成提醒</div>
          <div v-for="reminder in workspace.completedReminders" :key="reminder.id" class="list-row compact-row reminder-row completed">
            <strong>{{ formatTime(reminder.remindAt) }} · {{ reminder.title }}</strong>
            <p>{{ studentName(reminder.studentId) }} · {{ reminder.relatedType }} · 已完成</p>
            <n-space>
              <n-button size="small" secondary @click="undoCompleteReminder(reminder.id)">撤回完成</n-button>
              <n-button v-if="props.userRole !== 'parent'" size="small" secondary type="error" @click="removeReminder(reminder.id)">删除</n-button>
            </n-space>
          </div>
        </div>
      </section>
      <aside class="side-panel">
        <h2>创建系统提醒</h2>
        <n-form label-placement="top">
          <n-form-item :label="cl">
            <n-select v-model:value="form.studentId" :options="childOptions" />
          </n-form-item>
          <n-form-item label="类型">
            <n-select v-model:value="form.relatedType" :options="typeOptions" />
          </n-form-item>
          <n-form-item label="标题">
            <n-input v-model:value="form.title" />
          </n-form-item>
          <n-form-item label="提醒时间">
            <n-date-picker v-model:value="form.remindAt" type="datetime" clearable />
          </n-form-item>
        </n-form>
        <n-button v-if="props.userRole !== 'parent'" type="primary" @click="createReminder"><Plus :size="16" /> 创建提醒</n-button>
      </aside>
    </div>
  </div>
</template>
