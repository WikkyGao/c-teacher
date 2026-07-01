<script setup lang="ts">
import {
  BellRing,
  BookOpen,
  CalendarCheck,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Cloud,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Plus,
  Settings2,
  UploadCloud,
  UsersRound,
  Video
} from "lucide-vue-next";
import { computed } from "vue";
import { childAvatarSourceFor } from "../../shared/assets/childAvatars";
import { useChildStore } from "../children/childStore";
import type { UserRole } from "../auth/authSession";
import { childLabel } from "../../shared/utils/childLabel";

const props = defineProps<{
  userRole?: UserRole;
}>();

const cl = computed(() => childLabel(props.userRole));

const emit = defineEmits<{
  navigate: [value: "children" | "schedule" | "records" | "materials" | "reminders"];
}>();

const students = useChildStore();
const todayStart = computed(() => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
});
const todayEnd = computed(() => todayStart.value + 24 * 60 * 60 * 1000);
const todayLessons = computed(() =>
  students.scheduledLessonCalendarItems.filter((lesson) => lesson.startsAt >= todayStart.value && lesson.startsAt < todayEnd.value)
);
const upcomingLessons = computed(() => {
  const source = todayLessons.value.length > 0 ? todayLessons.value : students.scheduledLessonCalendarItems.filter((lesson) => lesson.startsAt >= Date.now());
  return source.slice(0, 4);
});
const pendingHomework = computed(() =>
  students.classRecords.filter((record) => record.homework.trim() && record.gradingStatus === "待批改")
);
const progressRows = computed(() =>
  students.items.slice(0, 3).map((child) => ({
    child,
    courses: students.getStudentCourses(child.id).map((course) => ({ ...course, progress: courseProgress(course.progress) })),
    latest: latestActivityLabel(child.id)
  }))
);
const reminderItems = computed(() => students.sortedReminders.slice(0, 3));
const pendingMaterialCount = computed(() => students.materials.filter((material) => material.syncStatus !== "已索引").length);
const materialSyncLabel = computed(() => {
  if (students.materialSources.length === 0) return "未配置资料源";
  const available = students.materialSources.some((source) => source.connectionStatus === "可用");
  return available ? "资料源可用" : "已同步到云端";
});
const defaultModelLabel = computed(() => {
  const model = students.defaultAiModel;
  return model ? `${model.providerName} · ${model.name}` : "未配置模型";
});

const quickActions = [
  { label: "发布作业", icon: FileText, nav: "records" },
  { label: "布置课堂任务", icon: CheckSquare, nav: "schedule" },
  { label: "课堂记录", icon: Video, nav: "records" },
  { label: "上传资料", icon: UploadCloud, nav: "materials" },
  { label: "创建测验", icon: ClipboardList, nav: "records" },
  { label: "学习报告", icon: LayoutDashboard, nav: "children" }
] satisfies Array<{ label: string; icon: unknown; nav: "children" | "schedule" | "records" | "materials" | "reminders" }>;

function courseProgress(value: number | undefined) {
  return value ?? 0;
}

function studentAvatar(child: { gender: "male" | "female" }) {
  return childAvatarSourceFor(students.appSettings.themeKey, child.gender);
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function latestActivityLabel(studentId: string) {
  const latestRecord = students.classRecords
    .filter((record) => record.studentId === studentId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  if (!latestRecord) return "暂无记录";
  const minutes = Math.max(1, Math.round((Date.now() - new Date(latestRecord.createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.round(hours / 24)}天前`;
}

function childClassLabel(studentId: string) {
  const index = students.items.findIndex((child) => child.id === studentId);
  return index === -1 ? `${cl.value}档案` : `高二（${index + 1}）班`;
}

function openStudentDetail(studentId: string) {
  students.selectStudent(studentId);
  emit("navigate", "children");
}
</script>

<template>
  <div class="workbench-page">
    <header class="workbench-topbar">
      <div>
        <h1 class="page-title">工作台</h1>
        <p class="page-subtitle">今天的课程、{{ cl }}进度与待办提醒</p>
      </div>
    </header>

    <section class="workbench-metrics">
      <button class="workbench-metric-card" type="button" @click="emit('navigate', 'children')">
        <span class="workbench-metric-icon blue"><UsersRound :size="30" /></span>
        <div>
          <p>{{ cl }}数</p>
          <strong>{{ students.items.length }} <small>人</small></strong>
          <em>较昨日 ↑ {{ Math.max(1, Math.min(5, students.items.length - 1)) }}</em>
        </div>
      </button>
      <button class="workbench-metric-card" type="button" @click="emit('navigate', 'schedule')">
        <span class="workbench-metric-icon teal"><CalendarCheck :size="30" /></span>
        <div>
          <p>今日课程</p>
          <strong>{{ todayLessons.length }} <small>节</small></strong>
          <em>已完成 {{ students.completedReminders.length }} 节 · 进行中 {{ todayLessons.length > 0 ? 1 : 0 }} 节</em>
        </div>
      </button>
      <button class="workbench-metric-card" type="button" @click="emit('navigate', 'records')">
        <span class="workbench-metric-icon orange"><CheckSquare :size="30" /></span>
        <div>
          <p>待批改作业</p>
          <strong>{{ pendingHomework.length }} <small>份</small></strong>
          <em>较昨日 ↑ {{ Math.max(1, pendingHomework.length) }}</em>
        </div>
      </button>
    </section>

    <main class="workbench-main-grid">
      <section class="workbench-panel workbench-schedule-panel">
        <header>
          <h2>今日课程安排</h2>
          <n-button v-if="props.userRole !== 'parent'" type="primary" @click="emit('navigate', 'schedule')">
            <template #icon><Plus :size="16" /></template>
            添加课程
          </n-button>
        </header>
        <div class="workbench-course-list">
          <button
            v-for="(lesson, index) in upcomingLessons"
            :key="lesson.id"
            class="workbench-course-row"
            type="button"
            @click="emit('navigate', 'schedule')"
          >
            <div class="workbench-course-topline">
              <span>{{ formatTime(lesson.startsAt) }} - {{ formatTime(lesson.endsAt) }}</span>
              <em :class="{ active: index === 1 }">{{ index === 0 ? "已完成" : index === 1 ? "进行中" : "未开始" }}</em>
            </div>
            <div class="workbench-course-main">
              <span class="workbench-course-icon" :class="`tone-${index % 4}`">
                <BookOpen v-if="index % 4 === 1" :size="22" />
                <FlaskConical v-else-if="index % 4 === 3" :size="22" />
                <span v-else-if="index % 4 === 2">英语</span>
                <ClipboardList v-else :size="22" />
              </span>
              <div>
                <strong>{{ lesson.subject }} · {{ lesson.topic || "课程复盘" }}</strong>
                <p>{{ childClassLabel(lesson.studentId) }} · {{ lesson.studentName }}</p>
              </div>
            </div>
            <div class="workbench-course-bottomline">
              <span>{{ lesson.durationMinutes }} 分钟</span>
              <ChevronRight :size="17" />
            </div>
          </button>
          <div v-if="upcomingLessons.length === 0" class="workbench-empty-row">今天暂未安排课程</div>
        </div>
        <footer>
          <button type="button" @click="emit('navigate', 'schedule')">查看完整课程表 <ChevronRight :size="15" /></button>
        </footer>
      </section>

      <section class="workbench-panel workbench-progress-panel">
        <header>
          <h2>学习进度</h2>
          <button type="button" @click="emit('navigate', 'children')">查看全部 <ChevronRight :size="15" /></button>
        </header>
        <div class="workbench-progress-list">
          <button v-for="row in progressRows" :key="row.child.id" class="workbench-progress-row" type="button" @click="openStudentDetail(row.child.id)">
            <span class="workbench-child-cell">
              <img :src="studentAvatar(row.child)" :alt="`${row.child.name}头像`" />
              <b>{{ row.child.name }}<small>{{ childClassLabel(row.child.id) }}</small></b>
              <em>{{ row.latest }}</em>
            </span>
            <span class="workbench-subject-progress">
              <span v-for="course in row.courses" :key="course.subject" class="workbench-progress-value">
                <b>{{ course.subject }}</b>
                <strong>{{ course.progress }}%</strong>
              </span>
            </span>
          </button>
        </div>
        <footer>
          <button type="button" @click="emit('navigate', 'children')">查看{{ cl }}管理 <ChevronRight :size="15" /></button>
        </footer>
      </section>

      <aside class="workbench-side-stack">
        <section class="workbench-panel workbench-reminder-panel">
          <header>
            <h2>待办提醒</h2>
            <button type="button" @click="emit('navigate', 'reminders')">查看全部 <ChevronRight :size="15" /></button>
          </header>
          <button v-for="(reminder, index) in reminderItems" :key="reminder.id" class="workbench-reminder-row" type="button" @click="emit('navigate', 'reminders')">
            <span :class="`tone-${index}`"><BellRing v-if="index === 1" :size="18" /><FileText v-else :size="18" /></span>
            <b>{{ reminder.title }}<small>{{ childClassLabel(reminder.studentId) }} · {{ reminder.relatedType }}</small></b>
            <i>{{ index + 1 }}</i>
            <ChevronRight :size="16" />
          </button>
          <div v-if="reminderItems.length === 0" class="workbench-empty-row">暂无待办提醒</div>
        </section>

        <section class="workbench-panel workbench-status-panel">
          <h2>资料同步</h2>
          <div class="workbench-status-row">
            <span><Cloud :size="22" /></span>
            <b>{{ materialSyncLabel }}<small>待同步资料 {{ pendingMaterialCount }} 份</small></b>
            <button type="button" @click="emit('navigate', 'materials')">立即同步</button>
          </div>
        </section>

        <section class="workbench-panel workbench-status-panel">
          <h2>AI 模型状态</h2>
          <div class="workbench-status-row">
            <span><Settings2 :size="22" /></span>
            <b>模型运行正常<small>{{ defaultModelLabel }}</small></b>
            <em>在线</em>
          </div>
        </section>
      </aside>
    </main>

    <section v-if="props.userRole !== 'parent'" class="workbench-panel workbench-actions">
      <h2>快捷操作</h2>
      <button v-for="action in quickActions" :key="action.label" type="button" @click="emit('navigate', action.nav)">
        <span><component :is="action.icon" :size="21" /></span>
        {{ action.label }}
      </button>
    </section>
  </div>
</template>
