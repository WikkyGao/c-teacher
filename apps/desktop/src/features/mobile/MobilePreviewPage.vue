<script setup lang="ts">
import {
  BellRing,
  CalendarDays,
  LayoutDashboard,
  LibraryBig,
  Plus,
  UsersRound
} from "lucide-vue-next";
import type { Component } from "vue";
import { computed, ref, watch } from "vue";
import { useChildStore } from "../children/childStore";
import { childLabel } from "../../shared/utils/childLabel";
import type { UserRole } from "../auth/authSession";
import {
  mobilePlatformOptions,
  mobilePlatforms,
  mobileQuickActions,
  type MobilePlatformKey
} from "./mobilePreviewConfig";

type MobileAppTab = "dashboard" | "children" | "schedule" | "materials";

const props = defineProps<{ userRole?: UserRole }>();
const cl = computed(() => childLabel(props.userRole));

const workspace = useChildStore();
const selectedChildId = ref(workspace.activeChildId);
const activePlatform = ref<MobilePlatformKey>("app");
const activeTab = ref<MobileAppTab>("dashboard");
const isActionOpen = ref(false);

const childOptions = computed(() => workspace.items.map((child) => ({ label: child.name, value: child.id })));
const selectedChild = computed(() => workspace.items.find((child) => child.id === selectedChildId.value) ?? workspace.activeChild);
const selectedLessons = computed(() => {
  return workspace.scheduledLessonCalendarItems.filter((lesson) => lesson.studentId === selectedChild.value.id).slice(0, 4);
});
const selectedMaterials = computed(() => workspace.materialTitlesForStudent(selectedChild.value.id));
const selectedReminders = computed(() =>
  workspace.incompleteReminders.filter((reminder) => reminder.studentId === selectedChild.value.id)
);
const dashboardStats = computed(() => [
  { label: "课程", value: workspace.getStudentCourses(selectedChild.value.id).length },
  { label: "提醒", value: selectedReminders.value.length },
  { label: "资料", value: selectedMaterials.value.length }
]);

const mobileTabs: Array<{ key: MobileAppTab; label: string; icon: Component }> = [
  { key: "dashboard", label: "工作台", icon: LayoutDashboard },
  { key: "children", label: `${cl.value}管理`, icon: UsersRound },
  { key: "schedule", label: "课程表", icon: CalendarDays },
  { key: "materials", label: "资料库", icon: LibraryBig }
];

const activePlatformMeta = computed(() => mobilePlatforms[activePlatform.value]);
const quickActions = computed(() => mobileQuickActions[activePlatform.value]);
const activeTitle = computed(() => mobileTabs.find((tab) => tab.key === activeTab.value)?.label ?? "工作台");

watch(selectedChildId, (studentId) => {
  workspace.selectStudent(studentId);
});

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">手机预览</h1>
        <p class="page-subtitle">在 Mac 上查看移动端页面结构，支持小程序和 App 两种终端：工作台、{{ cl }}管理、课程表、资料库、提醒和快捷操作。</p>
      </div>
      <n-space align="center">
        <n-segmented v-model:value="activePlatform" :options="mobilePlatformOptions" />
        <n-select v-model:value="selectedChildId" :options="childOptions" class="mobile-child-select" />
      </n-space>
    </div>

    <section class="mobile-preview-layout">
      <aside class="side-panel">
        <h2>{{ activePlatformMeta.previewTitle }}</h2>
        <div class="mobile-platform-brief">
          <strong>{{ activePlatformMeta.shellLabel }}</strong>
          <span>{{ activePlatformMeta.headerCaption }}</span>
        </div>
        <div class="mobile-capability-list" aria-label="移动端能力">
          <span v-for="capability in activePlatformMeta.capabilities" :key="capability">{{ capability }}</span>
        </div>
        <h3 class="side-section-title">页面模块</h3>
        <button
          v-for="tab in mobileTabs"
          :key="tab.key"
          class="mobile-preview-tab"
          :class="{ active: activeTab === tab.key }"
          type="button"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" :size="17" />
          <span>{{ tab.label }}</span>
        </button>
      </aside>

      <section class="phone-stage" aria-label="手机端效果预览">
        <div class="phone-frame">
          <div class="phone-speaker"></div>
          <div class="phone-screen" :class="`phone-screen-${activePlatform}`">
            <div class="mobile-shell-bar">
              <span>{{ activePlatformMeta.shellLabel }}</span>
              <strong>{{ activePlatform === "miniProgram" ? "···" : "5G 100%" }}</strong>
            </div>
            <header class="mobile-app-header">
              <div>
                <span>C-teacher</span>
                <strong>{{ activeTitle }}</strong>
              </div>
              <button class="mobile-reminder-button" type="button" aria-label="提醒">
                <BellRing :size="18" />
                <i v-if="selectedReminders.length">{{ selectedReminders.length }}</i>
              </button>
            </header>

            <main class="mobile-app-body">
              <template v-if="activeTab === 'dashboard'">
                <section class="mobile-summary-card">
                  <div>
                    <span>当前{{ cl }}</span>
                    <strong>{{ selectedChild.name }}</strong>
                    <p>{{ selectedChild.goal }}</p>
                    <button type="button">{{ activePlatformMeta.primaryActionLabel }}</button>
                  </div>
                  <div class="mobile-flat-illustration" aria-hidden="true">
                    <i></i>
                    <b></b>
                    <em></em>
                  </div>
                </section>
                <div class="mobile-stat-strip" aria-label="移动端概览">
                  <span v-for="stat in dashboardStats" :key="stat.label">
                    <strong>{{ stat.value }}</strong>
                    <small>{{ stat.label }}</small>
                  </span>
                </div>
                <article v-for="course in workspace.getStudentCourses(selectedChild.id)" :key="course.subject" class="mobile-card">
                  <strong>{{ course.subject }} · {{ course.progress }}%</strong>
                  <span>第 {{ course.currentLesson }}/{{ course.totalLessons }} 节</span>
                  <div class="mobile-progress"><i :style="{ width: `${course.progress}%` }"></i></div>
                </article>
              </template>

              <template v-else-if="activeTab === 'children'">
                <article v-for="child in workspace.items" :key="child.id" class="mobile-card">
                  <strong>{{ child.name }}</strong>
                  <span>{{ child.goal }} · {{ child.style }}</span>
                </article>
              </template>

              <template v-else-if="activeTab === 'schedule'">
                <div v-if="selectedLessons.length === 0" class="mobile-empty">暂无课程安排</div>
                <article v-for="lesson in selectedLessons" :key="lesson.id" class="mobile-card">
                  <strong>{{ lesson.subject }} · {{ lesson.durationMinutes }} 分钟</strong>
                  <span>{{ formatDateTime(lesson.startsAt) }} · {{ lesson.topic || "未填写课程内容" }}</span>
                </article>
              </template>

              <template v-else>
                <div v-if="selectedMaterials.length === 0" class="mobile-empty">暂无资料</div>
                <article v-for="material in selectedMaterials" :key="material" class="mobile-card">
                  <strong>{{ material }}</strong>
                  <span>已分配学习资料</span>
                </article>
              </template>
            </main>

            <div v-if="isActionOpen" class="mobile-action-sheet">
              <button v-for="action in quickActions" :key="action.label" type="button">
                <component :is="action.icon" :size="17" />
                <span>
                  <strong>{{ action.label }}</strong>
                  <small>{{ action.description }}</small>
                </span>
              </button>
            </div>

            <button class="mobile-add-button" type="button" aria-label="添加" @click="isActionOpen = !isActionOpen">
              <Plus :size="24" />
            </button>

            <nav class="mobile-tabbar">
              <button
                v-for="tab in mobileTabs"
                :key="tab.key"
                type="button"
                :class="{ active: activeTab === tab.key }"
                @click="activeTab = tab.key"
              >
                <component :is="tab.icon" :size="16" />
                <span>{{ tab.label }}</span>
              </button>
            </nav>
          </div>
        </div>
      </section>
    </section>
  </div>
</template>
