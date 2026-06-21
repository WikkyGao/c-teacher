<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NEmpty, NModal, NSpace, NTag } from "naive-ui";
import { CheckCircle2, RotateCcw, Shuffle, TrendingUp } from "lucide-vue-next";
import { useChildStore, type MistakeRecord } from "../children/childStore";
import { formatMistakeContent } from "./contentFormatter";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
}>();

const students = useChildStore();
const currentIndex = ref(0);
const showAnswer = ref(false);
const mode = ref<"random" | "weak">("random");

const reviewRecords = computed(() => {
  let records = students.activeChildMistakeRecords.filter((r) => r.masteryStatus === "待复习");
  if (mode.value === "weak") {
    const kpCounts: Record<string, number> = {};
    for (const r of records) {
      for (const kp of r.knowledgePoints) {
        kpCounts[kp] = (kpCounts[kp] || 0) + 1;
      }
    }
    records = [...records].sort((a, b) => {
      const aScore = a.knowledgePoints.reduce((sum, kp) => sum + (kpCounts[kp] || 0), 0);
      const bScore = b.knowledgePoints.reduce((sum, kp) => sum + (kpCounts[kp] || 0), 0);
      return bScore - aScore;
    });
  } else {
    records = [...records].sort(() => Math.random() - 0.5);
  }
  return records;
});

const currentRecord = computed(() => reviewRecords.value[currentIndex.value] || null);
const totalCount = computed(() => reviewRecords.value.length);

function shuffleCards() {
  mode.value = "random";
  currentIndex.value = 0;
  showAnswer.value = false;
}

function sortWeakFirst() {
  mode.value = "weak";
  currentIndex.value = 0;
  showAnswer.value = false;
}

function nextCard() {
  if (currentIndex.value < totalCount.value - 1) {
    currentIndex.value++;
    showAnswer.value = false;
  }
}

function prevCard() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    showAnswer.value = false;
  }
}

function toggleAnswer() {
  showAnswer.value = !showAnswer.value;
}

async function markMastered() {
  if (!currentRecord.value) return;
  await students.toggleMistakeMastery(currentRecord.value.id);
  if (currentIndex.value >= totalCount.value - 1 && totalCount.value > 1) {
    currentIndex.value = 0;
  }
}

function difficultyColor(diff: string) {
  const map: Record<string, "success" | "info" | "warning" | "error"> = {
    "简单": "success",
    "中等": "info",
    "困难": "warning",
    "挑战": "error"
  };
  return map[diff] || "info";
}
</script>

<template>
  <n-modal :show="show" preset="card" title="错题复习" style="width: 650px; max-height: 85vh" @update:show="emit('update:show', $event)">
    <div class="review-mode">
      <div v-if="totalCount === 0" class="review-empty">
        <n-empty description="暂无待复习的错题" />
      </div>

      <template v-else>
        <div class="review-toolbar">
          <n-button :type="mode === 'random' ? 'primary' : 'default'" size="small" @click="shuffleCards">
            <template #icon><Shuffle :size="14" /></template>
            随机
          </n-button>
          <n-button :type="mode === 'weak' ? 'primary' : 'default'" size="small" @click="sortWeakFirst">
            <template #icon><TrendingUp :size="14" /></template>
            薄弱优先
          </n-button>
          <span class="review-count">{{ currentIndex + 1 }} / {{ totalCount }}</span>
        </div>

        <div class="review-card-scroll">
          <div v-if="currentRecord" class="review-card" @click="toggleAnswer">
            <div class="card-header">
              <n-tag :type="difficultyColor(currentRecord.difficulty)" size="small" round>{{ currentRecord.difficulty }}</n-tag>
              <n-tag size="small">{{ currentRecord.subject }}</n-tag>
            </div>

            <div class="card-question">
              <h3>题目</h3>
              <p v-if="currentRecord.questionText" v-html="formatMistakeContent(currentRecord.questionText)"></p>
              <p v-else>（图片题）</p>
            </div>

            <div v-if="currentRecord.imagePath" class="card-image-hint">
              📷 该题含图片，请在详情中查看
            </div>

            <div v-if="currentRecord.knowledgePoints.length > 0" class="card-tags">
              <n-tag v-for="kp in currentRecord.knowledgePoints.slice(0, 3)" :key="kp" size="tiny" :bordered="false">{{ kp }}</n-tag>
            </div>

            <div v-if="showAnswer" class="card-answer">
              <div class="answer-section">
                <h4>参考答案</h4>
                <p v-if="currentRecord.correctAnswer" v-html="formatMistakeContent(currentRecord.correctAnswer)"></p>
                <p v-else>待教师确认</p>
              </div>
              <div class="answer-section">
                <h4>错误原因</h4>
                <p v-if="currentRecord.mistakeReason" v-html="formatMistakeContent(currentRecord.mistakeReason)"></p>
                <p v-else>暂无</p>
              </div>
              <div v-if="currentRecord.similarQuestions.length > 0" class="answer-section">
                <h4>类似题</h4>
                <ol>
                  <li v-for="(q, i) in currentRecord.similarQuestions" :key="i" v-html="formatMistakeContent(q)"></li>
                </ol>
              </div>
            </div>

            <div v-else class="card-flip-hint">
              点击查看答案
            </div>
          </div>
        </div>

        <div class="review-actions">
          <n-button :disabled="currentIndex <= 0" @click="prevCard">上一题</n-button>
          <n-button type="primary" @click="markMastered">
            <template #icon><CheckCircle2 :size="14" /></template>
            标为已掌握
          </n-button>
          <n-button :disabled="currentIndex >= totalCount - 1" @click="nextCard">下一题</n-button>
        </div>
      </template>
    </div>
  </n-modal>
</template>

<style scoped>
.review-mode {
  display: flex;
  flex-direction: column;
  height: 580px;
  overflow: hidden;
}

.review-empty {
  padding: 40px 0;
}

.review-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 6px;
}

.review-count {
  margin-left: auto;
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
}

.review-card-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.review-card {
  background: var(--surface-soft);
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-height: 200px;
}

.review-card:hover {
  border-color: var(--action);
}

.card-header {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.card-question h3 {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 6px;
}

.card-question p {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
}

.card-image-hint {
  font-size: 13px;
  color: var(--muted);
  margin-top: 8px;
}

.card-tags {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.card-answer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.answer-section {
  margin-bottom: 12px;
}

.answer-section h4 {
  font-size: 13px;
  color: var(--action);
  margin-bottom: 4px;
}

.answer-section p, .answer-section ol {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
}

.answer-section ol {
  margin-left: 20px;
}

.card-flip-hint {
  text-align: center;
  padding: 20px;
  color: var(--muted);
  font-size: 14px;
}

.review-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
