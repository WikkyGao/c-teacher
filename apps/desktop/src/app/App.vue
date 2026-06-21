<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import LoginPage from "../features/auth/LoginPage.vue";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../features/auth/authSession";
import type { UserRole } from "../features/auth/authSession";
import BackupPage from "../features/backup/BackupPage.vue";
import DashboardPage from "../features/dashboard/DashboardPage.vue";
import DiagnosticsPage from "../features/diagnostics/DiagnosticsPage.vue";
import MaterialLibraryPage from "../features/materials/MaterialLibraryPage.vue";
import MobilePreviewPage from "../features/mobile/MobilePreviewPage.vue";
import ClassRecordPage from "../features/records/ClassRecordPage.vue";
import ReminderPage from "../features/reminders/ReminderPage.vue";
import SchedulePage from "../features/schedule/SchedulePage.vue";
import SettingsPage from "../features/settings/SettingsPage.vue";
import ChildManagementPage from "../features/children/ChildManagementPage.vue";
import { useChildStore } from "../features/children/childStore";
import type { TeacherProfile } from "../features/children/childStore";
import type { NavKey } from "../shared/types/navigation";
import { naiveThemeOverridesFor } from "./appThemeOverrides";
import Shell from "./Shell.vue";
import { checkSilent } from "../features/updater/versionCheck";

onMounted(() => {
  checkSilent();
});

const activeNav = ref<NavKey>("children");
const childPageTarget = ref<"list" | "detail" | "mistakeBook">("list");
const authSession = ref(getAuthSession());
const workspace = useChildStore();
const naiveThemeOverrides = computed(() => naiveThemeOverridesFor(workspace.appSettings.themeKey));

const activeComponent = computed(() => {
    const pages: Record<NavKey, unknown> = {
      dashboard: DashboardPage,
      children: ChildManagementPage,
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

function login(userName: string, role: UserRole) {
  saveAuthSession(userName, role);
  workspace.updateTeacherProfile({ name: userName, title: role === "teacher" ? "" : "家长", bio: role === "teacher" ? "" : "家长视图 · 只读" });
  authSession.value = getAuthSession();
  activeNav.value = role === "parent" ? "dashboard" : "children";
}

function logout() {
  clearAuthSession();
  authSession.value = getAuthSession();
  activeNav.value = "children";
}

function navigateFromPage(value: NavKey) {
  if (value === "children") {
    childPageTarget.value = "detail";
  }
  activeNav.value = value;
}

function navigateFromShell(value: NavKey) {
  if (value === "children") {
    childPageTarget.value = "list";
  }
  activeNav.value = value;
}

function saveTeacherProfile(profile: TeacherProfile) {
  if (!workspace.updateTeacherProfile(profile)) return;
  saveAuthSession(profile.name, "teacher");
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
          :user-role="authSession.role"
          :reminder-count="workspace.incompleteReminders.length"
          :teacher-profile="workspace.appSettings.teacherProfile"
          @update:active-nav="navigateFromShell"
          @save:teacher-profile="saveTeacherProfile"
          @logout="logout"
        >
          <component
            :is="activeComponent"
            :user-name="authSession.userName"
            :user-role="authSession.role"
            :initial-mode="activeNav === 'children' ? childPageTarget : undefined"
            @navigate="navigateFromPage"
            @logout="logout"
          />
        </Shell>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
