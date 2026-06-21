<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  useMessage
} from "naive-ui";
import {
  ArrowLeft,
  FileImage,
  NotebookPen,
  Pencil,
  Printer,
  RotateCcw,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  UsersRound
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useChildStore, type MistakeRecord, type Child, type ChildGroup } from "../children/childStore";
import { childAvatarSourceFor } from "../../shared/assets/childAvatars";
import { analyzeMistakeStreamMulti, generateSimilarQuestionsStream } from "./mistakeApi";
import { exportMistakesToPrint } from "./mistakeExport";
import BatchImportModal from "./BatchImportModal.vue";
import MistakeCardList from "./MistakeCardList.vue";
import MistakeDetailView from "./MistakeDetailView.vue";
import MistakeStatsDashboard from "./MistakeStatsDashboard.vue";
import ReviewMode from "./ReviewMode.vue";
import TagManageModal from "./TagManageModal.vue";
import MobileConnectModal from "../mobile/MobileConnectModal.vue";

import type { UserRole } from "../auth/authSession";

const props = defineProps<{
  studentId?: string;
  userRole?: UserRole;
}>();

const emit = defineEmits<{
  back: [];
}>();

const students = useChildStore();
const message = useMessage();
const { activeChild, defaultAiModel } = storeToRefs(students);
const modelSupportsVision = computed(() => defaultAiModel.value?.supportsVision ?? false);

const selectedChildId = ref(props.studentId || activeChild.value?.id || "");
const activeMistakeSubject = ref("");
const selectedRecord = ref<MistakeRecord | null>(null);
const detailViewRef = ref<InstanceType<typeof MistakeDetailView> | null>(null);

const pageView = ref<"list" | "detail">("list");
const sidebarCollapsed = ref(false);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

const mistakeInputMode = ref<"text" | "image">("text");
const mistakeQuestionText = ref("");
const selectedMistakeImagePath = ref("");
const selectedMistakeImageDataUrl = ref("");
const streamingAnalysisText = ref("");
const isAnalyzingMistake = ref(false);

const centerTab = ref("list");
const showBatchImport = ref(false);
const showReviewMode = ref(false);
const showTagManage = ref(false);
const showMobileConnectModal = ref(false);
const selectedGroupId = ref<string | null>(null);

const filteredStudents = computed(() => {
  if (!selectedGroupId.value) return students.items;
  if (selectedGroupId.value === "ungrouped") return students.ungroupedStudents;
  const group = students.groups.find((g) => g.id === selectedGroupId.value);
  return group ? students.items.filter((s) => group.memberIds.includes(s.id)) : students.items;
});

const treeItems = computed(() => {
  const items: Array<{ key: string; label: string; count: number; type: "all" | "class" | "subject" | "ungrouped"; group?: ChildGroup }> = [];
  items.push({ key: "all", label: "全部小孩", count: students.items.length, type: "all" });
  for (const g of students.classes) {
    items.push({ key: g.id, label: g.name, count: g.memberIds.length, type: "class" as const, group: g });
  }
  for (const g of students.subjectGroups) {
    items.push({ key: g.id, label: g.name, count: g.memberIds.length, type: "subject" as const, group: g });
  }
  const ungrouped = students.ungroupedStudents.length;
  if (ungrouped > 0) items.push({ key: "ungrouped", label: "未分组", count: ungrouped, type: "ungrouped" });
  return items;
});

function studentGroupsFor(studentId: string) {
  return students.studentGroupsFor(studentId);
}

const currentStudent = computed(() => {
  return students.items.find((s) => s.id === selectedChildId.value) || activeChild.value;
});

const subjectOptions = computed(() => {
  return currentStudent.value.mistakeBook.subjects.map((s) => ({ label: s, value: s }));
});

const stats = computed(() => students.activeChildMistakeStats);

function cleanOutputText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/```/g, "")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\div/g, "÷")
    .replace(/\\times/g, "×")
    .replace(/\\pm/g, "±")
    .replace(/\\mp/g, "∓")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\infty/g, "∞")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\$+/g, "")
    .trim();
}

function openDetail(record: MistakeRecord) {
  selectedRecord.value = record;
  pageView.value = "detail";
}

function closeDetail() {
  pageView.value = "list";
  selectedRecord.value = null;
}

function getStudentAvatar(child: Child): string {
  return childAvatarSourceFor(students.appSettings.themeKey, child.gender);
}

function getStudentMistakeCount(studentId: string): number {
  return students.mistakeRecords.filter(r => r.studentId === studentId).length;
}

function handleStudentChange(studentId: string) {
  selectedChildId.value = studentId;
  students.selectStudent(studentId);
  students.loadMistakeRecords(studentId);
  activeMistakeSubject.value = "";
  pageView.value = "list";
  selectedRecord.value = null;
  selectedGroupId.value = null;
}

function handleCreateNew() {
  mistakeInputMode.value = "text";
  mistakeQuestionText.value = "";
  streamingAnalysisText.value = "";
}

async function chooseMistakeImage() {
  if (!isTauri()) {
    message.info("Web 预览环境请在桌面端上传错题图片");
    return;
  }
  if (!activeMistakeSubject.value) {
    message.warning("请先选择科目");
    return;
  }
  const selected = await open({
    multiple: false,
    filters: [{ name: "错题图片", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (typeof selected !== "string") return;
  selectedMistakeImagePath.value = selected;
  try {
    selectedMistakeImageDataUrl.value = await invoke<string>("read_mistake_image_data_url", { path: selected });
  } catch {
    selectedMistakeImageDataUrl.value = "";
  }
  await runAiAnalysis();
}

async function runAiAnalysis() {
  const questionText = mistakeQuestionText.value.trim();
  if (!questionText && mistakeInputMode.value === "text") {
    message.warning("请输入题目内容");
    return;
  }
  if (mistakeInputMode.value === "image" && !selectedMistakeImagePath.value) {
    message.warning("请先上传错题图片");
    return;
  }

  isAnalyzingMistake.value = true;
  streamingAnalysisText.value = "";

  try {
    const results = await analyzeMistakeStreamMulti({
      studentId: selectedChildId.value,
      subject: activeMistakeSubject.value || currentStudent.value.mistakeBook.subjects[0],
      questionText,
      studentAnswer: "暂无作答",
      imagePath: mistakeInputMode.value === "image" ? selectedMistakeImagePath.value : undefined
    }, (_delta, fullContent) => {
      streamingAnalysisText.value = fullContent;
    });

    const subject = activeMistakeSubject.value || currentStudent.value.mistakeBook.subjects[0];
    const imagePath = mistakeInputMode.value === "image" ? selectedMistakeImagePath.value : undefined;

    for (const item of results) {
      await students.createMistakeRecord({
        studentId: selectedChildId.value,
        subject,
        questionText: item.questionText || questionText,
        imagePath,
        studentAnswer: "暂无作答",
        correctAnswer: item.correctAnswer,
        mistakeReason: item.mistakeReason,
        knowledgePoints: item.knowledgePoints
      });
    }

    students.updateMistakeAnalysis(selectedChildId.value, {
      analysis: results.map((r) => r.mistakeReason).join("\n---\n"),
      knowledgeInsight: [...new Set(results.flatMap((r) => r.knowledgePoints))].join("、"),
      aiPending: Math.max(currentStudent.value.mistakeBook.aiPending - 1, 0)
    });

    message.success(`AI 分析完成，识别到 ${results.length} 道题，已保存到错题本`);
    mistakeQuestionText.value = "";
    streamingAnalysisText.value = "";
  } catch (error) {
    message.error(`AI 分析失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isAnalyzingMistake.value = false;
  }
}

async function handleExportPrint() {
  const records = students.activeChildMistakeRecords;
  if (records.length === 0) {
    message.warning("暂无错题记录可导出");
    return;
  }
  try {
    await exportMistakesToPrint(records, currentStudent.value?.name || "小孩");
    message.success("已打开打印预览");
  } catch (error) {
    message.error(`导出失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function handleMobileImage(path: string) {
  // A new mistake image arrived from the mobile phone
  selectedMistakeImagePath.value = path;
  mistakeInputMode.value = "image";
  mistakeQuestionText.value = "";

  try {
    selectedMistakeImageDataUrl.value = await invoke<string>("read_mistake_image_data_url", { path });
  } catch {
    message.warning("图片预览加载失败，但仍可进行分析");
    selectedMistakeImageDataUrl.value = "";
  }

  // Auto-trigger AI analysis
  await runAiAnalysis();
}

onMounted(() => {
  if (selectedChildId.value) {
    students.selectStudent(selectedChildId.value);
    students.loadMistakeRecords(selectedChildId.value);
    students.loadMistakeTags();
  }
});
</script>

<template>
  <div class="mistake-book-page">
    <!-- Detail view toolbar (matches child-page-toolbar style) -->
    <div v-if="pageView === 'detail'" class="child-page-toolbar detail-toolbar">
      <n-button secondary @click="closeDetail">
        <template #icon><ArrowLeft :size="16" /></template>
        返回错题列表
      </n-button>
      <div class="detail-header-center">
        <img
          v-if="currentStudent"
          class="detail-header-avatar"
          :src="getStudentAvatar(currentStudent)"
          :alt="`${currentStudent.name}头像`"
        />
        <span class="detail-header-name">{{ currentStudent?.name }}</span>
      </div>
      <n-space>
        <n-button size="small" secondary @click="detailViewRef?.startEdit()">
          <template #icon><Pencil :size="14" /></template>
          编辑
        </n-button>
        <n-button
          size="small"
          :type="selectedRecord?.masteryStatus === '已掌握' ? 'warning' : 'primary'"
          @click="detailViewRef?.toggleMastery()"
        >
          {{ selectedRecord?.masteryStatus === '已掌握' ? '标为待复习' : '标为已掌握' }}
        </n-button>
        <n-button size="small" type="error" secondary @click="detailViewRef?.handleDelete()">
          <template #icon><Trash2 :size="14" /></template>
          删除
        </n-button>
      </n-space>
    </div>

    <!-- Normal list header -->
    <header v-if="pageView !== 'detail'" class="page-header">
      <div class="header-left">
        <n-button quaternary @click="emit('back')">
          <template #icon><ArrowLeft :size="18" /></template>
        </n-button>
        <div class="header-title">
          <h1>错题本</h1>
          <p>管理错题，AI 辅助分析薄弱知识点</p>
        </div>
      </div>
      <n-space>
        <n-button secondary @click="showTagManage = true">
          <template #icon><Tag :size="16" /></template>
          标签管理
        </n-button>
        <n-button secondary @click="showReviewMode = true">
          <template #icon><RotateCcw :size="16" /></template>
          复习模式
        </n-button>
        <n-button secondary @click="showBatchImport = true">
          <template #icon><FileImage :size="16" /></template>
          批量导入
        </n-button>
        <n-button secondary @click="handleExportPrint">
          <template #icon><Printer :size="16" /></template>
          导出打印
        </n-button>
        <n-button type="primary" @click="showMobileConnectModal = true">
          <template #icon><Smartphone :size="16" /></template>
          手机拍照
        </n-button>
      </n-space>
    </header>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Collapsible Child Sidebar (Plan C) — hidden in detail view -->
      <aside v-if="pageView !== 'detail'" class="child-sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-header">
          <UsersRound v-if="!sidebarCollapsed" :size="16" />
          <span v-if="!sidebarCollapsed">小孩列表</span>
          <n-button text size="tiny" @click="toggleSidebar" :style="sidebarCollapsed ? '' : 'margin-left:auto'">
            {{ sidebarCollapsed ? '»' : '«' }}
          </n-button>
        </div>
        <template v-if="!sidebarCollapsed">
          <!-- Group tabs -->
          <div class="sidebar-groups">
            <button
              v-for="item in treeItems"
              :key="item.key"
              class="group-tree-item"
              :class="{
                active: (item.key === 'all' && !selectedGroupId) || selectedGroupId === item.key || (item.key === 'ungrouped' && selectedGroupId === 'ungrouped'),
                'group-type-class': item.type === 'class',
                'group-type-subject': item.type === 'subject',
              }"
              @click="selectedGroupId = (item.key === 'all' ? null : item.key)"
            >
              <span
                v-if="item.type === 'class' || item.type === 'subject'"
                class="group-color-dot"
                :style="{ background: item.group?.color }"
              />
              <span v-else-if="item.type === 'all'" class="group-icon">⊞</span>
              <span v-else-if="item.type === 'ungrouped'" class="group-icon">⊟</span>
              <span class="group-tree-label">{{ item.label }}</span>
              <span class="group-tree-count">{{ item.count }}</span>
            </button>
          </div>
          <div class="sidebar-divider">小孩</div>
          <!-- Child list -->
          <div class="child-list">
            <div v-if="filteredStudents.length === 0" class="sidebar-empty">无小孩</div>
            <div
              v-for="child in filteredStudents"
              :key="child.id"
              class="child-item"
              :class="{ active: selectedChildId === child.id }"
              @click="handleStudentChange(child.id)"
            >
              <img class="child-avatar" :src="getStudentAvatar(child)" :alt="`${child.name}头像`" />
              <div class="child-info">
                <span class="child-name">{{ child.name }}</span>
                <span class="child-stats">{{ getStudentMistakeCount(child.id) }} 道错题</span>
              </div>
            </div>
          </div>
        </template>
      </aside>

      <!-- Center: Card List / Detail / Stats -->
      <div class="content-center" :class="{ 'content-full': pageView === 'detail' }">
          <!-- Detail view -->
          <div v-if="pageView === 'detail'" class="detail-page">
            <MistakeDetailView
              ref="detailViewRef"
              v-if="selectedRecord"
              :record="selectedRecord"
              @close="closeDetail"
              @deleted="closeDetail"
            />
          </div>

          <!-- Normal list view -->
          <div v-if="pageView === 'list'" class="list-view">
            <div class="page-header">
              <div class="page-title">
                <h1>{{ currentStudent?.name }} · 错题本</h1>
                <p>管理和复习错题，巩固薄弱知识点</p>
              </div>
              <div class="stats-row">
                <div class="stat-pill">总题数 <span class="num">{{ stats.total }} 题</span></div>
                <div class="stat-pill">已掌握 <span class="num">{{ stats.mastered }} 题</span></div>
                <div class="stat-pill">正确率 <span class="num">{{ stats.total > 0 ? Math.round(stats.mastered / stats.total * 100) : 0 }}%</span></div>
              </div>
            </div>

            <div class="card-list-container">
              <n-tabs v-model:value="centerTab" type="line" size="small">
                <n-tab-pane name="list" tab="错题列表">
                  <MistakeCardList
                    :student-id="selectedChildId"
                    :subject="activeMistakeSubject"
                    :user-role="props.userRole"
                    @open-detail="openDetail"
                    @create-new="handleCreateNew"
                  />
                </n-tab-pane>
                <n-tab-pane name="stats" tab="统计看板">
                  <MistakeStatsDashboard />
                </n-tab-pane>
              </n-tabs>
            </div>
          </div>
        </div>

        <!-- Right: AI Analysis Panel — hidden in detail view -->
        <div v-if="pageView !== 'detail'" class="content-right">
          <div class="ai-panel">
            <div class="ai-panel-header">
              <span>AI 分析</span>
            </div>
            <p class="ai-panel-desc">粘贴题目文本，AI将自动分析错题原因、知识点关联和学习建议</p>

            <div class="ai-subject-select">
              <span class="select-label">科目</span>
              <n-select
                v-model:value="activeMistakeSubject"
                :options="subjectOptions"
                style="flex: 1"
                size="small"
                placeholder="选择科目"
              />
            </div>

            <div class="ai-input-section">
              <n-tabs v-model:value="mistakeInputMode" type="segment" size="small">
                <n-tab-pane name="text" tab="手动输入">
                  <n-input
                    v-model:value="mistakeQuestionText"
                    type="textarea"
                    placeholder="输入题目内容..."
                    :autosize="{ minRows: 3, maxRows: 6 }"
                  />
                </n-tab-pane>
                <n-tab-pane name="image" tab="图片上传">
                  <div class="image-upload-area">
                    <n-button type="primary" block @click="chooseMistakeImage">
                      <template #icon><FileImage :size="16" /></template>
                      {{ selectedMistakeImagePath ? "重新选择" : "选择图片" }}
                    </n-button>
                    <p class="muted-text">png/jpg/jpeg/webp，最大 8MB</p>
                    <div v-if="selectedMistakeImageDataUrl" class="image-preview">
                      <img :src="selectedMistakeImageDataUrl" alt="预览" />
                    </div>
                  </div>
                </n-tab-pane>
              </n-tabs>
            </div>

            <div class="ai-actions">
              <n-button
                type="primary"
                block
                :loading="isAnalyzingMistake"
                @click="runAiAnalysis"
              >
                <template #icon><Sparkles :size="16" /></template>
                AI 分析
              </n-button>
            </div>

            <!-- AI Output -->
            <div class="ai-output">
              <div v-if="isAnalyzingMistake" class="output-section">
                <div class="output-loading">
                  <n-spin size="small" />
                  <span>正在分析...</span>
                </div>
              </div>

              <div v-if="streamingAnalysisText" class="output-section">
                <h4><Sparkles :size="14" /> 分析结果</h4>
                <div class="output-content">{{ cleanOutputText(streamingAnalysisText) }}</div>
              </div>

            <div v-if="!isAnalyzingMistake && !streamingAnalysisText" class="output-placeholder">
              <Sparkles :size="24" />
              <p>输入题目后点击按钮开始分析</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Batch Import -->
    <BatchImportModal
      v-model:show="showBatchImport"
      :student-id="selectedChildId"
      :subject="activeMistakeSubject || currentStudent.mistakeBook.subjects[0]"
      @complete="students.loadMistakeRecords(selectedChildId)"
    />

    <!-- Review Mode -->
    <ReviewMode v-model:show="showReviewMode" />

    <!-- Tag Manage -->
    <TagManageModal v-model:show="showTagManage" />

    <!-- Mobile Connect -->
    <MobileConnectModal
      :show="showMobileConnectModal"
      @update:show="(v: boolean) => showMobileConnectModal = v"
      @new-image="handleMobileImage"
    />
  </div>
</template>

<style scoped>
.mistake-book-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 28px;
  background: var(--panel-solid);
  border-bottom: 1px solid var(--border);
  position: relative;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.header-title p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

.child-sidebar {
  width: 200px;
  min-width: 200px;
  background: var(--panel-solid);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s, min-width 0.2s;
}

.child-sidebar.collapsed {
  width: 44px;
  min-width: 44px;
}

.sidebar-groups {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.sidebar-divider {
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.child-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.child-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s;
}

.child-item:hover {
  background: var(--surface-soft);
}

.child-item.active {
  background: var(--action-soft);
}

.child-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.child-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.child-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.child-stats {
  font-size: 12px;
  color: var(--muted);
}

.content-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px 0;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1a2332;
  margin-bottom: 4px;
}

.page-title p {
  font-size: 14px;
  color: #8896a7;
}

.stats-row {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  color: #5a6b7f;
}

.stat-pill .num {
  font-weight: 700;
  font-size: 15px;
  color: #1a2332;
}

.list-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.card-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
}

.content-right {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
}

.ai-panel {
  background: var(--panel-solid);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ai-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 24px 24px 0;
  font-weight: 700;
  color: #1a2332;
  font-size: 18px;
}

.ai-panel-desc {
  padding: 8px 24px 0;
  font-size: 13px;
  color: #8896a7;
  line-height: 1.6;
}

.ai-subject-select {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 24px 0;
}

.select-label {
  font-size: 14px;
  color: var(--muted-strong);
  white-space: nowrap;
  font-weight: 500;
}

.ai-input-section {
  padding: 16px 24px;
}

.image-upload-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--surface-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.image-preview {
  margin-top: 8px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
}

.image-preview img {
  width: 100%;
  height: auto;
  display: block;
  max-height: 150px;
  object-fit: contain;
  background: var(--panel-solid);
}

.muted-text {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}

.ai-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 24px 20px;
}

.ai-output {
  flex: 1;
  padding: 16px 24px;
  border-top: 1px solid #e8edf2;
  overflow-y: auto;
}

.output-section {
  margin-bottom: 14px;
}

.output-section h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--action);
  font-weight: 600;
}

.output-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
  background: var(--surface-soft);
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.output-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 0;
  color: var(--muted);
  font-size: 14px;
}

.output-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: var(--muted);
}

.output-placeholder p {
  margin: 10px 0 0;
  font-size: 14px;
}

/* Group tree items (shared) */
.group-tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: background 0.15s;
  text-align: left;
}

.group-tree-item:hover {
  background: var(--surface-soft);
}

.group-tree-item.active {
  background: var(--action-soft);
  font-weight: 600;
}

.group-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 10px;
  text-align: center;
}

.group-tree-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-tree-count {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

/* Detail page nav */
.detail-nav {
  padding: 8px 0 16px;
}

.detail-toolbar {
  padding: 12px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-solid);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-header-center {
  display: flex;
  align-items: center;
  gap: 10px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.detail-header-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  object-fit: cover;
}

.detail-header-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}


.content-full {
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

.detail-page {
  padding: 0 28px 32px;
  overflow-y: auto;
  flex: 1;
}
</style>
