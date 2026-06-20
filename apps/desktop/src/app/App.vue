<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import LoginPage from "../features/auth/LoginPage.vue";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../features/auth/authSession";
import BackupPage from "../features/backup/BackupPage.vue";
import DashboardPage from "../features/dashboard/DashboardPage.vue";
import DiagnosticsPage from "../features/diagnostics/DiagnosticsPage.vue";
import MaterialLibraryPage from "../features/materials/MaterialLibraryPage.vue";
import MobilePreviewPage from "../features/mobile/MobilePreviewPage.vue";
import ClassRecordPage from "../features/records/ClassRecordPage.vue";
import ReminderPage from "../features/reminders/ReminderPage.vue";
import SchedulePage from "../features/schedule/SchedulePage.vue";
import SettingsPage from "../features/settings/SettingsPage.vue";
import StudentManagementPage from "../features/students/StudentManagementPage.vue";
import { useStudentStore } from "../features/students/studentStore";
import type { TeacherProfile } from "../features/students/studentStore";
import type { NavKey } from "../shared/types/navigation";
import { naiveThemeOverridesFor } from "./appThemeOverrides";
import Shell from "./Shell.vue";
import { checkSilent } from "../features/updater/versionCheck";

onMounted(() => {
  checkSilent();
});

const activeNav = ref<NavKey>("students");
const studentPageTarget = ref<"list" | "detail" | "mistakeBook">("list");
const authSession = ref(getAuthSession());
const workspace = useStudentStore();
const naiveThemeOverrides = computed(() => naiveThemeOverridesFor(workspace.appSettings.themeKey));

const activeComponent = computed(() => {
    const pages: Record<NavKey, unknown> = {
      dashboard: DashboardPage,
      students: StudentManagementPage,
      schedule: SchedulePage,
      records: ClassRecordPage,
      materials: MaterialLibraryPage,
      reminders: ReminderPage,
      mobile: MobilePreviewPage,
      diagnostics: DiagnosticsPage,
      settings: SettingsPage,
      backup: BackupPage
    };
    return pages[activeNav.value];
  });

watchEffect(() => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.appTheme = workspace.appSettings.themeKey;
});

function login(teacherName: string) {
  saveAuthSession(teacherName);
  workspace.updateTeacherProfile({ name: teacherName });
  authSession.value = getAuthSession();
}

function logout() {
  clearAuthSession();
  authSession.value = getAuthSession();
  activeNav.value = "students";
}

function navigateFromPage(value: NavKey) {
  if (value === "students") {
    studentPageTarget.value = "detail";
  }
  activeNav.value = value;
}

function navigateFromShell(value: NavKey) {
  if (value === "students") {
    studentPageTarget.value = "list";
  }
  activeNav.value = value;
}

function saveTeacherProfile(profile: TeacherProfile) {
  if (!workspace.updateTeacherProfile(profile)) return;
  saveAuthSession(profile.name);
  authSession.value = getAuthSession();
}
</script>

<template>
  <n-config-provider :theme-overrides="naiveThemeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <LoginPage v-if="!authSession.isAuthenticated" @login="login" />
        <Shell
          v-else
          :active-nav="activeNav"
          :reminder-count="workspace.incompleteReminders.length"
          :teacher-profile="workspace.appSettings.teacherProfile"
          @update:active-nav="navigateFromShell"
          @save:teacher-profile="saveTeacherProfile"
        >
          <component
            :is="activeComponent"
            :teacher-name="authSession.teacherName"
            :initial-mode="activeNav === 'students' ? studentPageTarget : undefined"
            @navigate="navigateFromPage"
            @logout="logout"
          />
        </Shell>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
