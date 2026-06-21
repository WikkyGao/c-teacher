<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { NButton, NEmpty, NInput, NPopconfirm, NSelect, NSpace, NSpin, NTag } from "naive-ui";
import { NotebookPen, RefreshCw, Search } from "lucide-vue-next";
import { useChildStore, type MistakeRecord } from "../children/childStore";
import { formatMistakeContent } from "./contentFormatter";
import type { UserRole } from "../auth/authSession";

const props = defineProps<{
  studentId: string;
  subject?: string;
  userRole?: UserRole;
}>();

const emit = defineEmits<{
  openDetail: [record: MistakeRecord];
  createNew: [];
}>();

const students = useChildStore();
const selectedSubject = ref(props.subject || "");
const selectedKnowledgePoint = ref("");
const keyword = ref("");

const subjectOptions = [
  { label: "全部科目", value: "" },
  ...[
    "数学", "语文", "英语", "物理", "化学", "生物",
    "历史", "地理", "政治", "信息技术", "科学", "其他"
  ].map((s) => ({ label: s, value: s }))
];

const knowledgePointOptions = computed(() => {
  const points = new Set<string>();
  for (const r of students.activeChildMistakeRecords) {
    for (const kp of r.knowledgePoints) {
      if (kp) points.add(kp);
    }
  }
  return [
    { label: "全部知识点", value: "" },
    ...Array.from(points).sort().map((p) => ({ label: p, value: p }))
  ];
});

const filteredRecords = computed(() => {
  let records = students.activeChildMistakeRecords;

  if (selectedSubject.value) {
    records = records.filter((r) => r.subject === selectedSubject.value);
  }
  if (selectedKnowledgePoint.value) {
    records = records.filter((r) => r.knowledgePoints.includes(selectedKnowledgePoint.value));
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase();
    records = records.filter((r) =>
      r.questionText.toLowerCase().includes(kw) ||
      r.knowledgePoints.some((kp) => kp.toLowerCase().includes(kw)) ||
      r.tags.some((t) => t.toLowerCase().includes(kw))
    );
  }
  return records;
});

const filteredStats = computed(() => {
  const records = filteredRecords.value;
  return {
    total: records.length,
    pending: records.filter((r) => r.masteryStatus === "待复习").length,
    mastered: records.filter((r) => r.masteryStatus === "已掌握").length
  };
});

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function difficultyClass(diff: string) {
  const map: Record<string, string> = { "简单": "diff-easy", "中等": "diff-medium", "困难": "diff-hard", "挑战": "diff-hard" };
  return map[diff] || "diff-medium";
}

function masteryClass(status: string) {
  return status === "已掌握" ? "status-mastered" : "status-practicing";
}

async function toggleMastery(record: MistakeRecord) {
  await students.toggleMistakeMastery(record.id);
}

async function handleDelete(record: MistakeRecord) {
  await students.deleteMistakeRecord(record.id);
}

onMounted(() => {
  students.loadMistakeRecords(props.studentId, props.subject);
  students.loadMistakeTags();
});

watch(() => props.studentId, (id) => {
  students.loadMistakeRecords(id, props.subject);
});

watch(() => props.subject, (s) => {
  selectedSubject.value = s || "";
});
</script>

<template>
  <div class="mistake-card-list">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <n-space size="small" align="center" wrap>
        <n-input
          v-model:value="keyword"
          placeholder="搜索题目关键字"
          size="small"
          clearable
          style="width: 180px"
        >
          <template #prefix><Search :size="14" /></template>
        </n-input>
        <n-select
          v-model:value="selectedSubject"
          :options="subjectOptions"
          size="small"
          style="width: 100px"
          placeholder="科目"
        />
        <n-select
          v-model:value="selectedKnowledgePoint"
          :options="knowledgePointOptions"
          size="small"
          style="width: 140px"
          placeholder="知识点"
        />
        <n-button
          size="small"
          secondary
          @click="selectedSubject = ''; selectedKnowledgePoint = ''; keyword = ''"
        >
          重置
        </n-button>
        <n-button size="small" secondary @click="students.loadMistakeRecords(studentId, subject)">
          <template #icon><RefreshCw :size="14" /></template>
        </n-button>
      </n-space>
    </div>

    <n-spin :show="students.isLoadingMistakeRecords">
      <div v-if="filteredRecords.length === 0" class="mistake-empty">
        <n-empty description="暂无错题记录">
          <template #extra>
            <n-button type="primary" @click="emit('createNew')">
              <template #icon><NotebookPen :size="14" /></template>
              录入错题
            </n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="mistake-cards">
        <div
          v-for="record in filteredRecords"
          :key="record.id"
          class="mistake-card"
          @click="emit('openDetail', record)"
        >
          <div class="card-tags">
            <span class="tag" :class="difficultyClass(record.difficulty)">{{ record.difficulty }}</span>
            <span class="tag" :class="masteryClass(record.masteryStatus)">
              <span v-if="record.masteryStatus === '已掌握'" class="tag-icon">✓</span>
              <span v-else class="tag-icon">⟳</span>
              {{ record.masteryStatus === '已掌握' ? '已掌握' : '练习中' }}
            </span>
          </div>

          <div class="card-question" v-html="formatMistakeContent(record.questionText) || '（图片题）'"></div>

          <div v-if="record.knowledgePoints.length > 0" class="card-knowledge">
            <span
              v-for="kp in record.knowledgePoints.slice(0, 4)"
              :key="kp"
              class="kp-tag"
            >{{ kp }}</span>
            <span v-if="record.knowledgePoints.length > 4" class="kp-tag more">+{{ record.knowledgePoints.length - 4 }}</span>
          </div>

          <div class="card-footer" @click.stop>
            <button class="btn btn-primary" @click.stop="emit('openDetail', record)">查看详情</button>
            <button class="btn btn-outline" @click.stop="emit('openDetail', record)">重新练习</button>
          </div>

          <n-popconfirm
            v-if="props.userRole !== 'parent'"
            @positive-click="handleDelete(record)"
          >
            <template #trigger>
              <button class="mistake-card-delete-btn" @click.stop>🗑</button>
            </template>
            确定要删除这条错题记录吗？
          </n-popconfirm>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<style scoped>
.mistake-card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}

.mistake-empty {
  padding: 48px 0;
}

/* 卡片列表 */
.mistake-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mistake-card {
  position: relative;
  background: #fff;
  border: 1px solid #e8edf2;
  border-radius: 12px;
  padding: 20px 24px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.mistake-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

/* 标签 */
.card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.tag-icon {
  font-size: 12px;
}

.diff-easy { background: #e6f7ef; color: #0d7a4a; }
.diff-medium { background: #fef3cd; color: #92400e; }
.diff-hard { background: #fde8e8; color: #b91c1c; }

.status-practicing { background: #fef3cd; color: #92400e; }
.status-mastered { background: #e6f7ef; color: #0d7a4a; }

/* 题目 */
.card-question {
  font-size: 15px;
  line-height: 1.7;
  color: #1a2332;
  margin-bottom: 14px;
}

/* 知识点标签 */
.card-knowledge {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.kp-tag {
  padding: 3px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 12px;
  color: #5a6b7f;
  background: #f8fafc;
}

.kp-tag.more {
  color: #8896a7;
}

/* 按钮 */
.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.mistake-card-delete-btn {
  position: absolute;
  bottom: 12px;
  left: 16px;
  border: none;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  opacity: 0.35;
  transition: opacity 0.15s;
  padding: 2px 4px;
  line-height: 1;
}

.mistake-card-delete-btn:hover {
  opacity: 1;
}

.btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-primary {
  background: #1a2332;
  color: #fff;
}

.btn-primary:hover {
  background: #2d3a4d;
}

.btn-outline {
  background: #fff;
  border: 1px solid #d1d9e3;
  color: #1a2332;
}

.btn-outline:hover {
  border-color: #1a2332;
}
</style>
