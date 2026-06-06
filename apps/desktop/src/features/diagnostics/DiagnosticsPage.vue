<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, RefreshCw, Upload } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, onMounted, ref } from "vue";
import { useStudentStore } from "../students/studentStore";

type EntityCounts = {
  students: number;
  materials: number;
  materialSources: number;
  classRecords: number;
  reminders: number;
};

const workspace = useStudentStore();
const message = useMessage();
const isLoading = ref(false);
const isBackupBusy = ref(false);
const errorMessage = ref("");
const counts = ref<EntityCounts | null>(null);
const countRows = computed(() => [
  { label: "学生", value: counts.value?.students ?? 0, local: workspace.items.length },
  { label: "资料", value: counts.value?.materials ?? 0, local: workspace.materials.length },
  { label: "资料源", value: counts.value?.materialSources ?? 0, local: workspace.materialSources.length },
  { label: "课堂记录", value: counts.value?.classRecords ?? 0, local: workspace.classRecords.length },
  { label: "提醒", value: counts.value?.reminders ?? 0, local: workspace.reminders.length }
]);

async function refreshDiagnostics() {
  errorMessage.value = "";
  if (!isTauri()) {
    counts.value = null;
    errorMessage.value = "当前为 Web 预览环境，实体表诊断仅在 Tauri 桌面端可用。";
    return;
  }
  isLoading.value = true;
  try {
    counts.value = await invoke<EntityCounts>("workspace_entity_counts");
  } catch (error) {
    errorMessage.value = String(error);
  } finally {
    isLoading.value = false;
  }
}

async function exportBackup() {
  if (!isTauri()) {
    message.info("Web 预览环境不能导出桌面备份，请在 Tauri 桌面端使用");
    return;
  }
  const path = await save({
    defaultPath: "c-teacher-workspace-backup.json",
    filters: [{ name: "C-teacher Backup", extensions: ["json"] }]
  });
  if (!path) return;
  isBackupBusy.value = true;
  try {
    await invoke("export_workspace_backup", { path });
    message.success("工作台备份已导出");
  } catch (error) {
    message.error(`导出失败：${String(error)}`);
  } finally {
    isBackupBusy.value = false;
  }
}

async function importBackup() {
  if (!isTauri()) {
    message.info("Web 预览环境不能导入桌面备份，请在 Tauri 桌面端使用");
    return;
  }
  const path = await open({
    multiple: false,
    filters: [{ name: "C-teacher Backup", extensions: ["json"] }]
  });
  if (typeof path !== "string") return;
  isBackupBusy.value = true;
  try {
    await invoke("import_workspace_backup", { path });
    await workspace.reloadWorkspace();
    await refreshDiagnostics();
    message.success("工作台备份已导入");
  } catch (error) {
    message.error(`导入失败：${String(error)}`);
  } finally {
    isBackupBusy.value = false;
  }
}

onMounted(() => {
  void refreshDiagnostics();
});
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">应用诊断</h1>
        <p class="page-subtitle">查看本地 SQLite 实体表与当前工作台状态是否一致</p>
      </div>
      <n-button type="primary" :loading="isLoading" @click="refreshDiagnostics">
        <template #icon>
          <RefreshCw :size="16" />
        </template>
        刷新
      </n-button>
    </div>

    <section class="metric-grid">
      <div class="metric-card">
        <strong>{{ workspace.storageStatus }}</strong>
        <span>存储状态</span>
      </div>
      <div class="metric-card">
        <strong>{{ workspace.isHydrated ? "完成" : "加载中" }}</strong>
        <span>数据加载</span>
      </div>
      <div class="metric-card">
        <strong>{{ isTauri() ? "Tauri" : "Web" }}</strong>
        <span>运行环境</span>
      </div>
    </section>

    <section class="side-panel">
      <h2>备份与恢复</h2>
      <n-space>
        <n-button secondary :loading="isBackupBusy" @click="exportBackup">
          <template #icon>
            <Download :size="16" />
          </template>
          导出备份
        </n-button>
        <n-button secondary :loading="isBackupBusy" @click="importBackup">
          <template #icon>
            <Upload :size="16" />
          </template>
          导入备份
        </n-button>
      </n-space>
    </section>

    <section class="side-panel diagnostics-section">
      <h2>实体表计数</h2>
      <n-alert v-if="errorMessage" type="warning" :bordered="false">{{ errorMessage }}</n-alert>
      <div v-for="row in countRows" :key="row.label" class="list-row diagnostic-row">
        <strong>{{ row.label }}</strong>
        <p>SQLite：{{ row.value }} · 当前工作台：{{ row.local }}</p>
      </div>
    </section>
  </div>
</template>
