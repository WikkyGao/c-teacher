<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useDialog, useMessage } from "naive-ui";
import { computed, onMounted, ref } from "vue";
import { useStudentStore } from "../students/studentStore";
import { backupBlobFromStore, backupFilename, parseWorkspaceBackupFile, triggerBackupDownload } from "./workspaceBackup";

type BackupSummary = {
  students: number;
  materials: number;
  materialSources: number;
  classRecords: number;
  reminders: number;
  scheduledLessons: number;
  aiProviders: number;
};

const workspace = useStudentStore();
const message = useMessage();
const dialog = useDialog();
const isExporting = ref(false);
const isImporting = ref(false);
const fileInput = ref<HTMLInputElement>();

const summary = computed<BackupSummary>(() => ({
  students: workspace.items.length,
  materials: workspace.materials.length,
  materialSources: workspace.materialSources.length,
  classRecords: workspace.classRecords.length,
  reminders: workspace.reminders.length,
  scheduledLessons: workspace.scheduledLessons.length,
  aiProviders: workspace.appSettings.aiProviders.length
}));

const totalItems = computed(() =>
  Object.values(summary.value).reduce((a, b) => a + b, 0)
);

const storageEnv = computed(() => {
  if (!isTauri()) return "web";
  if (workspace.storageStatus === "sqlite") return "sqlite";
  return "local";
});

async function exportDesktop() {
  isExporting.value = true;
  try {
    const path = await save({
      defaultPath: backupFilename(),
      filters: [{ name: "C-teacher 备份", extensions: ["json"] }]
    });
    if (!path) return false;
    await invoke("export_workspace_backup", { path });
    message.success("备份已导出");
    return true;
  } catch (error) {
    message.error(`导出失败：${String(error)}`);
    return false;
  } finally {
    isExporting.value = false;
  }
}

function exportWeb() {
  triggerBackupDownload(backupBlobFromStore(workspace), backupFilename());
  message.success("备份已下载");
}

async function exportBackup() {
  if (!isTauri()) {
    exportWeb();
    return;
  }
  await exportDesktop();
}

async function importDesktop(path: string) {
  isImporting.value = true;
  try {
    await invoke("import_workspace_backup", { path });
    await workspace.reloadWorkspace();
    message.success("数据已恢复");
  } catch (error) {
    message.error(`恢复失败：${String(error)}`);
  } finally {
    isImporting.value = false;
  }
}

async function importWeb(file: File) {
  isImporting.value = true;
  try {
    const backup = await parseWorkspaceBackupFile(file);
    workspace.applyPersistedState(backup.state);
    message.success(`数据已恢复（共 ${totalItems.value} 项）`);
  } catch (error) {
    message.error(`恢复失败：${String(error)}`);
  } finally {
    isImporting.value = false;
  }
}

function onFilePicked(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  target.value = "";
  void importWeb(file);
}

function confirmImport() {
  dialog.warning({
    title: "恢复数据",
    content: "导入备份将覆盖当前所有数据，包括学生、课程、课堂记录、提醒和设置。此操作不可撤销，确认继续？",
    positiveText: "确认导入",
    negativeText: "取消",
    onPositiveClick: async () => {
      if (!isTauri()) {
        fileInput.value?.click();
        return;
      }
      isImporting.value = true;
      try {
        const path = await open({
          multiple: false,
          filters: [{ name: "C-teacher 备份", extensions: ["json"] }]
        });
        if (typeof path !== "string") return;
        await importDesktop(path);
      } catch (error) {
        message.error(`恢复失败：${String(error)}`);
      } finally {
        isImporting.value = false;
      }
    }
  });
}

onMounted(() => {
  if (!isTauri()) {
    message.info("当前为浏览器预览模式，备份文件通过浏览器下载/上传处理。", { duration: 4000 });
  }
});
</script>

<template>
  <div class="backup-h5">
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display:none"
      @change="onFilePicked"
    />

    <div class="h5-header">
      <div class="h5-header-top">
        <strong>C-teacher</strong>
        <span class="h5-env-badge" :class="storageEnv">
          {{ storageEnv === "sqlite" ? "桌面端" : storageEnv === "web" ? "浏览器预览" : "本地存储" }}
        </span>
      </div>
      <h1>数据备份与恢复</h1>
      <p>导出账号下所有数据为备份文件，或从备份文件恢复完整工作台数据。</p>
    </div>

    <div class="h5-summary-card">
      <div class="h5-summary-head">
        <span>数据概览</span>
        <span class="h5-summary-total">共 {{ totalItems }} 项</span>
      </div>
      <div class="h5-summary-grid">
        <div class="h5-summary-item">
          <div class="h5-si-icon students">S</div>
          <div>
            <div class="h5-si-num">{{ summary.students }}</div>
            <div class="h5-si-label">学生</div>
          </div>
        </div>
        <div class="h5-summary-item">
          <div class="h5-si-icon materials">M</div>
          <div>
            <div class="h5-si-num">{{ summary.materials }}</div>
            <div class="h5-si-label">资料</div>
          </div>
        </div>
        <div class="h5-summary-item">
          <div class="h5-si-icon records">R</div>
          <div>
            <div class="h5-si-num">{{ summary.classRecords }}</div>
            <div class="h5-si-label">课堂记录</div>
          </div>
        </div>
        <div class="h5-summary-item">
          <div class="h5-si-icon reminders">!</div>
          <div>
            <div class="h5-si-num">{{ summary.reminders }}</div>
            <div class="h5-si-label">提醒</div>
          </div>
        </div>
        <div class="h5-summary-item">
          <div class="h5-si-icon schedule">C</div>
          <div>
            <div class="h5-si-num">{{ summary.scheduledLessons }}</div>
            <div class="h5-si-label">排课</div>
          </div>
        </div>
        <div class="h5-summary-item">
          <div class="h5-si-icon ai">AI</div>
          <div>
            <div class="h5-si-num">{{ summary.aiProviders }}</div>
            <div class="h5-si-label">AI 供应商</div>
          </div>
        </div>
      </div>
    </div>

    <div class="h5-section-card">
      <h2>导出数据</h2>
      <p>将当前工作台所有数据打包为 .json 文件，保存到本地。</p>
      <button
        class="h5-btn h5-btn-primary"
        :class="{ loading: isExporting }"
        :disabled="isExporting || isImporting"
        @click="exportBackup"
      >
        <svg v-if="!isExporting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>{{ isExporting ? "导出中…" : "导出备份" }}</span>
      </button>
      <div v-if="storageEnv === 'web'" class="h5-env-hint">
        浏览器模式：点击后将直接下载备份文件
      </div>
    </div>

    <div class="h5-section-card h5-import-card">
      <h2>恢复数据</h2>
      <p>从之前导出的 .json 备份文件恢复全部数据。此操作会覆盖当前数据。</p>
      <button
        class="h5-btn h5-btn-danger"
        :class="{ loading: isImporting }"
        :disabled="isExporting || isImporting"
        @click="confirmImport"
      >
        <svg v-if="!isImporting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>{{ isImporting ? "恢复中…" : "恢复数据" }}</span>
      </button>
      <div v-if="storageEnv === 'web'" class="h5-env-hint">
        浏览器模式：确认后从本地选择备份文件上传恢复
      </div>
    </div>

    <div class="h5-footer-note">
      <p>备份文件包含完整的账号数据，建议定期导出保存。</p>
      <p>支持将备份文件转移到其他设备后导入恢复。</p>
    </div>
  </div>
</template>

<style scoped>
.backup-h5 {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 0 32px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}

.h5-header {
  padding: 20px 0 16px;
}
.h5-header-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.h5-header-top strong {
  font-size: 13px;
  font-weight: 600;
  color: #6b7a8a;
}
.h5-env-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 8px;
}
.h5-env-badge.sqlite { background: #e8f4f2; color: #0d6f65; }
.h5-env-badge.local { background: #fff3e6; color: #b85c1a; }
.h5-env-badge.web { background: #eef0f7; color: #1769d4; }

.h5-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: #1a2a3a;
  margin: 0 0 6px;
}
.h5-header p {
  font-size: 13px;
  color: #6b7a8a;
  line-height: 1.6;
  margin: 0;
}

/* Summary card */
.h5-summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 14px;
}
.h5-summary-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #1a2a3a;
}
.h5-summary-total {
  font-size: 12px;
  font-weight: 400;
  color: #8a9aaa;
}
.h5-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}
.h5-summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f8faff;
  border-radius: 8px;
}
.h5-si-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.h5-si-icon.students { background: #e8f4f2; color: #0d6f65; }
.h5-si-icon.materials { background: #eef0f7; color: #1769d4; }
.h5-si-icon.records { background: #fdf0e6; color: #b85c1a; }
.h5-si-icon.reminders { background: #fde8e8; color: #c0392b; }
.h5-si-icon.schedule { background: #f0e8f8; color: #7b4e8f; }
.h5-si-icon.ai { background: #e8f4fe; color: #1769d4; font-size: 10px; }
.h5-si-num { font-size: 16px; font-weight: 700; color: #1a2a3a; line-height: 1.2; }
.h5-si-label { font-size: 11px; color: #8a9aaa; }

/* Section cards */
.h5-section-card {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  margin-bottom: 12px;
}
.h5-section-card h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1a2a3a;
  margin: 0 0 4px;
}
.h5-section-card p {
  font-size: 13px;
  color: #6b7a8a;
  line-height: 1.6;
  margin: 0 0 14px;
}
.h5-env-hint {
  font-size: 11px;
  color: #a0b0c0;
  margin-top: 8px;
  text-align: center;
}

/* Buttons */
.h5-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 13px 20px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.h5-btn:active { transform: scale(0.98); }
.h5-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.h5-btn-primary {
  background: #0d6f65;
  color: #fff;
}
.h5-btn-primary:active:not(:disabled) { background: #0a5c54; }
.h5-btn-danger {
  background: #fff;
  color: #c0392b;
  border: 1.5px solid #e74c3c;
}
.h5-btn-danger:active:not(:disabled) { background: #fdf0ef; }
.h5-btn.loading { opacity: 0.7; }

/* Import card special */
.h5-import-card {
  border-left: 3px solid #e74c3c;
}

/* Footer */
.h5-footer-note {
  padding: 12px 4px;
}
.h5-footer-note p {
  font-size: 12px;
  color: #a0b0c0;
  line-height: 1.6;
  margin: 0 0 4px;
}
</style>
