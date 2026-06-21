<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { isTauri, invoke } from "@tauri-apps/api/core";
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage
} from "naive-ui";
import { Save, Sparkles, X, ZoomIn } from "lucide-vue-next";
import { useChildStore, type MistakeRecord } from "../children/childStore";
import { formatMistakeContent } from "./contentFormatter";
import { generateSimilarQuestionsStream } from "./mistakeApi";

const props = defineProps<{
  record: MistakeRecord;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [];
}>();

const students = useChildStore();
const message = useMessage();
const isEditing = ref(false);
const showImagePreview = ref(false);
const imageDataUrl = ref("");
const isLoadingImage = ref(false);
const isGeneratingSimilar = ref(false);
const similarQuestionsText = ref("");
const streamingSimilarText = ref("");
const similarDifficulty = ref("中等");
const similarCount = ref(3);

const similarDifficultyOptions = [
  { label: "简单", value: "简单" },
  { label: "中等", value: "中等" },
  { label: "困难", value: "困难" },
  { label: "挑战", value: "挑战" }
];

const similarCountOptions = [
  { label: "1 题", value: 1 },
  { label: "2 题", value: 2 },
  { label: "3 题", value: 3 },
  { label: "5 题", value: 5 }
];

const form = ref({
  questionText: "",
  studentAnswer: "",
  correctAnswer: "",
  mistakeReason: "",
  knowledgePoints: [] as string[],
  tags: [] as string[],
  masteryStatus: "待复习" as "待复习" | "已掌握",
  difficulty: "中等" as "简单" | "中等" | "困难" | "挑战",
  gradeLevel: "",
  semester: ""
});

const knowledgePointsText = ref("");
const tagsText = ref("");

const difficultyOptions = [
  { label: "简单", value: "简单" },
  { label: "中等", value: "中等" },
  { label: "困难", value: "困难" },
  { label: "挑战", value: "挑战" }
];

const masteryOptions = [
  { label: "待复习", value: "待复习" },
  { label: "已掌握", value: "已掌握" }
];

function initForm() {
  if (!props.record) return;
  form.value = {
    questionText: props.record.questionText,
    studentAnswer: props.record.studentAnswer,
    correctAnswer: props.record.correctAnswer,
    mistakeReason: props.record.mistakeReason,
    knowledgePoints: [...props.record.knowledgePoints],
    tags: [...props.record.tags],
    masteryStatus: props.record.masteryStatus,
    difficulty: props.record.difficulty,
    gradeLevel: props.record.gradeLevel,
    semester: props.record.semester
  };
  knowledgePointsText.value = props.record.knowledgePoints.join("、");
  tagsText.value = props.record.tags.join("、");
}

async function loadImage() {
  if (!props.record?.imagePath || !isTauri()) return;
  isLoadingImage.value = true;
  try {
    imageDataUrl.value = await invoke<string>("read_mistake_image_data_url", { path: props.record.imagePath });
  } catch {
    imageDataUrl.value = "";
  } finally {
    isLoadingImage.value = false;
  }
}

function openImagePreview() {
  if (imageDataUrl.value) showImagePreview.value = true;
}

async function handleGenerateSimilar() {
  if (!props.record) return;
  isGeneratingSimilar.value = true;
  streamingSimilarText.value = "";
  similarQuestionsText.value = "";

  try {
    const questions = await generateSimilarQuestionsStream({
      studentId: props.record.studentId,
      subject: props.record.subject,
      questionText: props.record.questionText || "（图片题）",
      studentAnswer: props.record.studentAnswer || "暂无作答",
      imagePath: props.record.imagePath || undefined,
      difficulty: similarDifficulty.value,
      count: similarCount.value
    }, (_delta, fullContent) => {
      streamingSimilarText.value = fullContent;
    });

    similarQuestionsText.value = questions.join("\n\n");
    streamingSimilarText.value = "";

    await students.updateMistakeRecord(props.record.id, {
      similarQuestions: questions
    });

    message.success("类似题已生成");
  } catch (error) {
    message.error(`生成失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isGeneratingSimilar.value = false;
  }
}

function startEdit() {
  initForm();
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
}

async function saveEdit() {
  if (!props.record) return;
  const kp = knowledgePointsText.value.split(/[、，,]/).map(s => s.trim()).filter(Boolean);
  const tg = tagsText.value.split(/[、，,]/).map(s => s.trim()).filter(Boolean);

  const success = await students.updateMistakeRecord(props.record.id, {
    questionText: form.value.questionText,
    studentAnswer: form.value.studentAnswer,
    correctAnswer: form.value.correctAnswer,
    mistakeReason: form.value.mistakeReason,
    knowledgePoints: kp,
    tags: tg,
    masteryStatus: form.value.masteryStatus,
    difficulty: form.value.difficulty,
    gradeLevel: form.value.gradeLevel,
    semester: form.value.semester
  });

  if (success) {
    message.success("错题已更新");
    isEditing.value = false;
  } else {
    message.error("更新失败");
  }
}

async function handleDelete() {
  if (!props.record) return;
  if (confirm("确定要删除这条错题记录吗？")) {
    const success = await students.deleteMistakeRecord(props.record.id);
    if (success) {
      message.success("错题已删除");
      emit("deleted");
      emit("close");
    }
  }
}

async function toggleMastery() {
  if (!props.record) return;
  await students.toggleMistakeMastery(props.record.id);
  message.success(props.record.masteryStatus === "已掌握" ? "已标为待复习" : "已标为已掌握");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

defineExpose({ startEdit, toggleMastery, handleDelete });

onMounted(() => {
  initForm();
  if (props.record?.imagePath) loadImage();
});

watch(() => props.record?.id, () => {
  initForm();
  similarQuestionsText.value = "";
  streamingSimilarText.value = "";
  if (props.record?.imagePath) loadImage();
  else imageDataUrl.value = "";
});
</script>

<template>
  <div class="mistake-detail-page">
    <!-- View Mode -->
    <div v-if="!isEditing" class="mistake-detail-view">
      <div class="detail-top-bar">
        <div class="detail-meta">
          <n-tag :type="record.masteryStatus === '已掌握' ? 'success' : 'warning'" size="small">
            {{ record.masteryStatus }}
          </n-tag>
          <n-tag type="info" size="small">{{ record.subject }}</n-tag>
          <n-tag size="small">{{ record.difficulty }}</n-tag>
          <span class="detail-date">{{ formatDate(record.createdAt) }}</span>
        </div>
      </div>

      <div v-if="record.imagePath" class="detail-section">
        <h4>错题图片</h4>
        <div class="image-thumbnail-container" @click="openImagePreview">
          <div v-if="isLoadingImage" class="image-loading">加载中...</div>
          <img v-else-if="imageDataUrl" :src="imageDataUrl" class="image-thumbnail" alt="错题图片" />
          <div v-else class="image-placeholder">
            <span>{{ record.imagePath.split(/[\\/]/).pop() }}</span>
          </div>
          <div v-if="imageDataUrl" class="image-zoom-icon">
            <ZoomIn :size="16" />
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>题干</h4>
        <div class="detail-text" v-html="formatMistakeContent(record.questionText) || '（未填写）'"></div>
      </div>

      <div v-if="record.studentAnswer" class="detail-section">
        <h4>作答</h4>
        <div class="detail-text" v-html="formatMistakeContent(record.studentAnswer)"></div>
      </div>

      <div class="detail-section">
        <h4>参考答案</h4>
        <div class="detail-text" v-html="formatMistakeContent(record.correctAnswer) || '待教师确认'"></div>
      </div>

      <div class="detail-section">
        <h4>错误原因</h4>
        <div class="detail-text" v-html="formatMistakeContent(record.mistakeReason) || '暂无分析'"></div>
      </div>

      <div v-if="record.knowledgePoints.length > 0" class="detail-section">
        <h4>知识点</h4>
        <div class="detail-tags">
          <n-tag v-for="kp in record.knowledgePoints" :key="kp" size="small">{{ kp }}</n-tag>
        </div>
      </div>

      <div v-if="record.tags.length > 0" class="detail-section">
        <h4>标签</h4>
        <div class="detail-tags">
          <n-tag v-for="tag in record.tags" :key="tag" type="info" size="small">{{ tag }}</n-tag>
        </div>
      </div>

      <div class="detail-section similar-section">
        <div class="similar-header">
          <h4>类似题</h4>
          <div class="similar-controls">
            <n-select v-model:value="similarDifficulty" :options="similarDifficultyOptions" size="tiny" style="width:80px" />
            <n-select v-model:value="similarCount" :options="similarCountOptions" size="tiny" style="width:70px" />
            <n-button size="tiny" type="primary" :loading="isGeneratingSimilar" @click="handleGenerateSimilar">
              <template #icon><Sparkles :size="12" /></template>
              生成
            </n-button>
          </div>
        </div>

        <n-spin :show="isGeneratingSimilar">
          <div v-if="streamingSimilarText" class="similar-streaming">
            <div class="detail-text">{{ streamingSimilarText }}</div>
          </div>
          <div v-else-if="similarQuestionsText" class="similar-result">
            <div v-for="(q, i) in similarQuestionsText.split('\n\n').filter(Boolean)" :key="i" class="similar-question-item">
              <div class="detail-text">{{ q }}</div>
            </div>
          </div>
          <div v-else-if="record.similarQuestions.length > 0" class="similar-result">
            <div v-for="(q, i) in record.similarQuestions" :key="i" class="similar-question-item">
              <div class="detail-text" v-html="formatMistakeContent(q)"></div>
            </div>
          </div>
          <div v-else class="similar-empty">
            <p>点击上方按钮生成类似题型</p>
          </div>
        </n-spin>
      </div>

    </div>

    <!-- Edit Mode -->
    <div v-else class="mistake-detail-edit">
      <n-form label-placement="top">
        <n-form-item label="题干">
          <n-input v-model:value="form.questionText" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="输入题目内容" />
        </n-form-item>
        <n-form-item label="作答">
          <n-input v-model:value="form.studentAnswer" type="textarea" :autosize="{ minRows: 1, maxRows: 3 }" placeholder="输入作答" />
        </n-form-item>
        <n-form-item label="参考答案">
          <n-input v-model:value="form.correctAnswer" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="输入正确答案和解题过程" />
        </n-form-item>
        <n-form-item label="错误原因">
          <n-input v-model:value="form.mistakeReason" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="分析错误原因" />
        </n-form-item>
        <n-form-item label="知识点（顿号分隔）">
          <n-input v-model:value="knowledgePointsText" placeholder="例如：函数图像、参数变化、平移变换" />
        </n-form-item>
        <n-form-item label="标签（顿号分隔）">
          <n-input v-model:value="tagsText" placeholder="例如：易错题、期中复习" />
        </n-form-item>
        <n-space>
          <n-form-item label="难度" style="flex:1">
            <n-select v-model:value="form.difficulty" :options="difficultyOptions" />
          </n-form-item>
          <n-form-item label="掌握状态" style="flex:1">
            <n-select v-model:value="form.masteryStatus" :options="masteryOptions" />
          </n-form-item>
        </n-space>
        <n-space>
          <n-form-item label="年级" style="flex:1">
            <n-input v-model:value="form.gradeLevel" placeholder="例如：高一" />
          </n-form-item>
          <n-form-item label="学期" style="flex:1">
            <n-input v-model:value="form.semester" placeholder="例如：上学期" />
          </n-form-item>
        </n-space>
        <n-space justify="end" style="margin-top:16px">
          <n-button @click="cancelEdit">
            <template #icon><X :size="14" /></template>
            取消
          </n-button>
          <n-button type="primary" @click="saveEdit">
            <template #icon><Save :size="14" /></template>
            保存
          </n-button>
        </n-space>
      </n-form>
    </div>

    <!-- Image Preview Modal -->
    <n-modal v-model:show="showImagePreview" preset="card" title="错题原图" style="max-width:90vw;max-height:90vh">
      <img v-if="imageDataUrl" :src="imageDataUrl" alt="错题原图" style="width:100%;height:auto;border-radius:8px" />
    </n-modal>
  </div>
</template>

<style scoped>
.mistake-detail-page {
  padding: 0;
}

.mistake-detail-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-nav {
  padding: 12px 0;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-date {
  font-size: 13px;
  color: var(--muted);
  margin-left: auto;
}

.detail-section h4 {
  font-size: 14px;
  color: var(--muted-strong);
  margin: 0 0 6px;
  font-weight: 600;
}

.detail-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text);
  margin: 0;
  white-space: pre-wrap;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.detail-actions {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.similar-question-item {
  padding: 12px;
  background: var(--surface-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  margin-bottom: 8px;
}

.similar-question-item .detail-text {
  font-size: 14px;
}

.similar-section {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px;
  background: var(--surface-soft);
}

.similar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.similar-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.similar-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.similar-streaming {
  padding: 12px;
  background: var(--panel-solid);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  border: 1px solid var(--border);
}

.similar-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.similar-empty {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 20px 0;
}

.similar-empty p { margin: 0; }

.mistake-detail-edit {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.image-thumbnail-container {
  position: relative;
  display: inline-block;
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
  max-width: 200px;
}

.image-thumbnail {
  display: block;
  max-width: 200px;
  max-height: 150px;
  object-fit: cover;
}

.image-loading {
  padding: 20px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.image-placeholder {
  padding: 14px;
  text-align: center;
  color: var(--muted-strong);
  font-size: 13px;
  background: var(--surface-soft);
}

.image-zoom-icon {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0,0,0,.6);
  color: white;
  border-radius: 6px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .2s;
}

.image-thumbnail-container:hover .image-zoom-icon { opacity: 1; }

.detail-text :deep(.math-block) {
  display: block;
  text-align: center;
  margin: 10px 0;
  font-style: italic;
}

.detail-text :deep(.math-inline) {
  font-style: italic;
}
</style>
