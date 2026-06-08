<script setup lang="ts">
import {
  Activity,
  BarChart3,
  BellRing,
  CalendarDays,
  ClipboardList,
  Database,
  LibraryBig,
  Pencil,
  Smartphone,
  Settings,
  UsersRound
} from "lucide-vue-next";
import type { Component } from "vue";
import { reactive, ref } from "vue";
import type { TeacherProfile } from "../features/students/studentStore";
import type { NavKey } from "../shared/types/navigation";
import { navItems, settingsNavItem } from "../shared/types/navigation";

const props = defineProps<{
  activeNav: NavKey;
  reminderCount: number;
  teacherProfile: TeacherProfile;
}>();

const emit = defineEmits<{
  "update:activeNav": [value: NavKey];
  "save:teacherProfile": [value: TeacherProfile];
}>();

const showTeacherEditor = ref(false);
const teacherDraft = reactive<TeacherProfile>({
  name: "",
  title: "",
  bio: ""
});

const navIcons: Record<NavKey, Component> = {
  dashboard: BarChart3,
  students: UsersRound,
  schedule: CalendarDays,
  records: ClipboardList,
  materials: LibraryBig,
  reminders: BellRing,
  mobile: Smartphone,
  diagnostics: Activity,
  settings: Settings,
  backup: Database
};

function openTeacherEditor() {
  Object.assign(teacherDraft, props.teacherProfile);
  showTeacherEditor.value = true;
}

function saveTeacherProfile() {
  emit("save:teacherProfile", { ...teacherDraft });
  showTeacherEditor.value = false;
}
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <button class="brand-block teacher-profile-trigger" type="button" @click="openTeacherEditor">
        <span class="brand-mark">{{ teacherProfile.name.slice(0, 1) || "师" }}</span>
        <div class="teacher-profile-copy">
          <div class="brand">{{ teacherProfile.name }}</div>
          <div class="brand-subtitle">{{ teacherProfile.title }}</div>
          <p>{{ teacherProfile.bio }}</p>
        </div>
        <Pencil class="teacher-profile-edit-icon" :size="15" />
      </button>
      <nav class="nav-stack" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: activeNav === item.key }"
          @click="emit('update:activeNav', item.key)"
        >
          <component :is="navIcons[item.key]" :size="17" />
          <span>{{ item.label }}</span>
          <i v-if="item.key === 'reminders' && reminderCount > 0" class="nav-reminder-badge">{{ reminderCount }}</i>
        </button>
      </nav>
      <button
        class="nav-item settings-nav-item"
        :class="{ active: activeNav === settingsNavItem.key }"
        @click="emit('update:activeNav', settingsNavItem.key)"
      >
        <Settings :size="17" />
        <span>{{ settingsNavItem.label }}</span>
      </button>
    </aside>
    <section class="workspace">
      <slot />
    </section>
  </main>

  <n-modal v-model:show="showTeacherEditor" preset="card" title="编辑教师信息" class="form-modal teacher-profile-modal">
    <div class="teacher-profile-form">
      <n-form label-placement="top">
        <n-form-item label="姓名">
          <n-input v-model:value="teacherDraft.name" placeholder="例如：王老师" maxlength="12" show-count />
        </n-form-item>
        <n-form-item label="职称/角色">
          <n-input v-model:value="teacherDraft.title" placeholder="例如：课程规划老师" maxlength="18" show-count />
        </n-form-item>
        <n-form-item label="说明">
          <n-input v-model:value="teacherDraft.bio" placeholder="例如：C-teacher · 本机教学工作台" maxlength="28" show-count />
        </n-form-item>
      </n-form>

      <div class="teacher-profile-actions">
        <n-button secondary @click="showTeacherEditor = false">取消</n-button>
        <n-button type="primary" :disabled="!teacherDraft.name.trim()" @click="saveTeacherProfile">保存</n-button>
      </div>
    </div>
  </n-modal>
</template>
