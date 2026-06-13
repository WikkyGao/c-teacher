<script setup lang="ts">
import { ref } from "vue";
import { NButton, NModal, NSpace, NSpin, NProgress, useMessage } from "naive-ui";
import { FileImage, X } from "lucide-vue-next";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useStudentStore } from "../students/studentStore";
import { analyzeMistakeStream } from "./mistakeApi";

const props = defineProps<{
  show: boolean;
  studentId: string;
  subject: string;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  complete: [];
}>();

const students = useStudentStore();
const message = useMessage();

type ImportItem = {
  file: string;
  imageDataUrl: string;
  status: "等待中" | "分析中" | "已完成" | "失败";
  error?: string;
};

const importQueue = ref<ImportItem[]>([]);
const currentIndex = ref(-1);
const isProcessing = ref(false);

const progress = ref(0);
const totalCount = ref(0);
const completedCount = ref(0);
const failedCount = ref(0);

async function selectImages() {
  if (!isTauri()) {
    message.info("Web 预览环境请在桌面端使用");
    return;
  }
  const selected = await open({
    multiple: true,
    filters: [{ name: "错题图片", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (!selected || !Array.isArray(selected) || selected.length === 0) return;

  const items: ImportItem[] = [];
  for (const filePath of selected) {
    try {
      const dataUrl = await invoke<string>("read_mistake_image_data_url", { path: filePath });
      items.push({ file: filePath, imageDataUrl: dataUrl, status: "等待中" });
    } catch {
      items.push({ file: filePath, imageDataUrl: "", status: "失败", error: "图片读取失败" });
    }
  }

  importQueue.value = items;
  totalCount.value = items.length;
  completedCount.value = 0;
  failedCount.value = items.filter((i) => i.status === "失败").length;
  progress.value = 0;
}

async function startBatchImport() {
  if (importQueue.value.length === 0) {
    message.warning("请先选择图片");
    return;
  }

  isProcessing.value = true;
  const validItems = importQueue.value.filter((i) => i.status === "等待中");

  for (let i = 0; i < validItems.length; i++) {
    if (!isProcessing.value) break;

    const item = validItems[i];
    currentIndex.value = importQueue.value.indexOf(item);
    item.status = "分析中";

    try {
      const result = await analyzeMistakeStream(
        {
          studentId: props.studentId,
          subject: props.subject,
          questionText: "",
          studentAnswer: "学生答案待补充",
          imagePath: item.file
        },
        () => {}
      );

      await students.createMistakeRecord({
        studentId: props.studentId,
        subject: props.subject,
        questionText: result.questionText || "（图片题）",
        imagePath: item.file,
        studentAnswer: "学生答案待补充",
        correctAnswer: result.correctAnswer,
        mistakeReason: result.mistakeReason,
        knowledgePoints: result.knowledgePoints,
        similarQuestions: result.similarQuestions
      });

      item.status = "已完成";
      completedCount.value++;
    } catch (error) {
      item.status = "失败";
      item.error = error instanceof Error ? error.message : "分析失败";
      failedCount.value++;
    }

    progress.value = Math.round(((i + 1) / validItems.length) * 100);
  }

  isProcessing.value = false;
  message.success(`批量导入完成：${completedCount.value} 成功，${failedCount.value} 失败`);
  emit("complete");
}

function stopImport() {
  isProcessing.value = false;
}

function handleClose() {
  if (isProcessing.value) {
    message.warning("正在导入中，请等待完成");
    return;
  }
  importQueue.value = [];
  currentIndex.value = -1;
  progress.value = 0;
  emit("update:show", false);
}

function removeItem(index: number) {
  importQueue.value.splice(index, 1);
  totalCount.value = importQueue.value.length;
}
</script>

<template>
  <n-modal :show="show" preset="card" title="批量导入错题" style="max-width: 600px" @update:show="handleClose">
    <div class="batch-import">
      <div v-if="importQueue.length === 0" class="import-select">
        <p>选择多张错题图片，AI 将自动逐张分析并保存到错题本。</p>
        <n-button type="primary" block @click="selectImages">
          <template #icon><FileImage :size="16" /></template>
          选择图片
        </n-button>
      </div>

      <template v-else>
        <div class="import-progress">
          <n-progress :percentage="progress" :status="progress === 100 ? 'success' : 'info'" />
          <span class="progress-text">已完成 {{ completedCount }} / {{ totalCount }}{{ failedCount > 0 ? `，失败 ${failedCount}` : "" }}</span>
        </div>

        <div class="import-list">
          <div
            v-for="(item, index) in importQueue"
            :key="index"
            class="import-item"
            :class="{ active: index === currentIndex, failed: item.status === '失败' }"
          >
            <img :src="item.imageDataUrl" class="import-thumb" alt="" />
            <div class="import-info">
              <span class="import-file">{{ item.file.split(/[\\/]/).pop() }}</span>
              <span class="import-status" :class="item.status">{{ item.status }}</span>
              <span v-if="item.error" class="import-error">{{ item.error }}</span>
            </div>
            <n-button v-if="item.status === '等待中'" size="tiny" quaternary @click="removeItem(index)">
              <template #icon><X :size="12" /></template>
            </n-button>
          </div>
        </div>

        <div class="import-actions">
          <n-button v-if="!isProcessing" type="primary" block @click="startBatchImport">
            开始分析
          </n-button>
          <n-button v-else type="error" block @click="stopImport">
            停止
          </n-button>
        </div>
      </template>
    </div>
  </n-modal>
</template>

<style scoped>
.batch-import {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.import-select {
  text-align: center;
  padding: 24px 0;
}

.import-select p {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 16px;
}

.import-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-text {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}

.import-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.import-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 6px;
  background: var(--surface-soft);
}

.import-item.active {
  background: #e3f2fd;
}

.import-item.failed {
  background: #ffebee;
}

.import-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.import-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.import-file {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-status {
  font-size: 12px;
}

.import-status.等待中 { color: var(--muted); }
.import-status.分析中 { color: #1976d2; }
.import-status.已完成 { color: #388e3c; }
.import-status.失败 { color: #d32f2f; }

.import-error {
  font-size: 11px;
  color: #d32f2f;
}

.import-actions {
  padding-top: 8px;
}
</style>
