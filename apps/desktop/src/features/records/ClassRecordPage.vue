<script setup lang="ts">
import { Plus, ArrowLeft, Trash2 } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { ClassRecord, GradingStatus, RecordType } from "../children/childStore";
import { useChildStore } from "../children/childStore";
import type { UserRole } from "../auth/authSession";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import { childAvatarSourceFor } from "../../shared/assets/childAvatars";

const RECORD_TYPES: RecordType[] = ["课堂讲授", "课堂练习", "课后作业", "实验报告", "测验考试", "项目任务", "辅导记录", "复习笔记"];

const RECORD_TYPE_ICONS: Record<RecordType, string> = {
  "课堂讲授": "📖",
  "课堂练习": "✏️",
  "课后作业": "📝",
  "实验报告": "🔬",
  "测验考试": "📋",
  "项目任务": "🚀",
  "辅导记录": "💡",
  "复习笔记": "📓"
};

const RECORD_TYPE_COLORS: Record<RecordType, string> = {
  "课堂讲授": "#0d6f65",
  "课堂练习": "#3b82f6",
  "课后作业": "#f59e0b",
  "实验报告": "#ef4444",
  "测验考试": "#8b5cf6",
  "项目任务": "#ec4899",
  "辅导记录": "#06b6d4",
  "复习笔记": "#84cc16"
};

const props = defineProps<{
  userRole?: UserRole;
}>();

const workspace = useChildStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const pageMode = ref<"list" | "form">("list");
const editingRecordId = ref<string | null>(null);
const assignMode = ref<"child" | "group">("child");

const form = reactive({
  studentId: workspace.activeChildId,
  groupId: null as string | null,
  subject: workspace.activeChild.courses[0]?.subject ?? "数学",
  recordType: "课堂讲授" as RecordType,
  lessonContent: "",
  performance: "",
  homework: ""
});

// --- 筛选状态 ---
const filterType = ref<RecordType | null>(null);
const filterSubject = ref<string | null>(null);
const filterGrading = ref<GradingStatus | null>(null);

const activeFilterCount = computed(() => {
  let count = 0;
  if (filterType.value) count++;
  if (filterSubject.value) count++;
  if (filterGrading.value) count++;
  return count;
});

const filteredRecords = computed(() => {
  return workspace.classRecords.filter((record) => {
    if (filterType.value && record.recordType !== filterType.value) return false;
    if (filterSubject.value && record.subject !== filterSubject.value) return false;
    if (filterGrading.value && record.gradingStatus !== filterGrading.value) return false;
    return true;
  });
});

const availableSubjects = computed(() => {
  const subjects = new Set(workspace.classRecords.map((r) => r.subject));
  return Array.from(subjects).sort();
});

const childOptions = computed(() => {
  return workspace.items.map((child) => ({ label: child.name, value: child.id }));
});

const selectedChild = computed(() => {
  return workspace.items.find((c) => c.id === form.studentId) ?? workspace.activeChild;
});
const groupOptions = computed(() =>
  workspace.groups.map((g) => ({ label: `${g.name}（${g.type === "class" ? "班级" : "科目"}）`, value: g.id }))
);

const SUBJECT_OPTIONS = ["数学", "英语", "物理", "语文"].map((s) => ({ label: s, value: s }));

const TYPE_OPTIONS = RECORD_TYPES.map((t) => ({ label: t, value: t }));

// --- 动态表单字段 computed（替代臃肿的 v-if 链条）---
interface DynamicFieldDef {
  key: string;
  label: string;
  bindTo: "lessonContent" | "performance" | "homework";
  placeholder: string;
  type: "textarea" | "input";
  required: boolean;
}

const dynamicFields = computed<DynamicFieldDef[]>(() => {
  const t = form.recordType;
  switch (t) {
    case "课堂讲授":
      return [
        { key: "content", label: "授课内容/主题", bindTo: "lessonContent", placeholder: "请输入授课内容或主题...", type: "textarea", required: true },
        { key: "performance", label: "课堂表现", bindTo: "performance", placeholder: "小孩课堂参与度、表现情况...", type: "textarea", required: false },
        { key: "homework", label: "作业布置", bindTo: "homework", placeholder: "布置的作业内容...", type: "input", required: false }
      ];
    case "课堂练习":
      return [
        { key: "content", label: "练习内容/题目", bindTo: "lessonContent", placeholder: "请输入练习内容或题目...", type: "textarea", required: true },
        { key: "performance", label: "完成情况", bindTo: "performance", placeholder: "完成情况...", type: "textarea", required: true },
        { key: "homework", label: "得分", bindTo: "homework", placeholder: "例如：85/100", type: "input", required: false }
      ];
    case "课后作业":
      return [
        { key: "content", label: "作业内容", bindTo: "lessonContent", placeholder: "请输入作业内容...", type: "textarea", required: true },
        { key: "homework", label: "截止日期", bindTo: "homework", placeholder: "例如：2026-07-01", type: "input", required: true },
        { key: "performance", label: "完成情况", bindTo: "performance", placeholder: "完成情况...", type: "textarea", required: false }
      ];
    case "实验报告":
      return [
        { key: "content", label: "实验名称", bindTo: "lessonContent", placeholder: "请输入实验名称...", type: "input", required: true },
        { key: "performance", label: "实验结论/完成情况", bindTo: "performance", placeholder: "实验结论、完成情况...", type: "textarea", required: true },
        { key: "homework", label: "得分", bindTo: "homework", placeholder: "例如：85/100", type: "input", required: false }
      ];
    case "测验考试":
      return [
        { key: "content", label: "测验名称", bindTo: "lessonContent", placeholder: "请输入测验名称...", type: "input", required: true },
        { key: "homework", label: "得分/总分", bindTo: "homework", placeholder: "例如：85/100", type: "input", required: true },
        { key: "performance", label: "错题记录", bindTo: "performance", placeholder: "错题记录...", type: "textarea", required: false }
      ];
    case "项目任务":
      return [
        { key: "content", label: "项目名称", bindTo: "lessonContent", placeholder: "请输入项目名称...", type: "input", required: true },
        { key: "performance", label: "任务描述/进度", bindTo: "performance", placeholder: "任务描述与当前进度...", type: "textarea", required: true },
        { key: "homework", label: "截止日期", bindTo: "homework", placeholder: "例如：2026-07-01", type: "input", required: true }
      ];
    case "辅导记录":
      return [
        { key: "content", label: "辅导主题", bindTo: "lessonContent", placeholder: "请输入辅导主题...", type: "input", required: true },
        { key: "performance", label: "辅导重点", bindTo: "performance", placeholder: "本次辅导的重点内容...", type: "textarea", required: true },
        { key: "homework", label: "下次计划", bindTo: "homework", placeholder: "下一步辅导计划...", type: "input", required: false }
      ];
    case "复习笔记":
      return [
        { key: "content", label: "复习主题", bindTo: "lessonContent", placeholder: "请输入复习主题...", type: "input", required: true },
        { key: "performance", label: "复习内容", bindTo: "performance", placeholder: "复习的知识点范围...", type: "textarea", required: true },
        { key: "homework", label: "备注", bindTo: "homework", placeholder: "补充说明...", type: "input", required: false }
      ];
    default:
      return [];
  }
});

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

function resetForm() {
  editingRecordId.value = null;
  assignMode.value = "child";
  form.studentId = workspace.activeChildId;
  form.groupId = null;
  form.subject = workspace.activeChild.courses[0]?.subject ?? "数学";
  form.recordType = "课堂讲授";
  form.lessonContent = "";
  form.performance = "";
  form.homework = "";
}

function editRecord(record: ClassRecord) {
  editingRecordId.value = record.id;
  assignMode.value = "child";
  form.studentId = record.studentId;
  form.groupId = null;
  form.subject = record.subject;
  form.recordType = record.recordType;
  form.lessonContent = record.lessonContent;
  form.performance = record.performance;
  form.homework = record.homework;
  pageMode.value = "form";
}

function openCreateForm() {
  resetForm();
  pageMode.value = "form";
}

function saveRecord() {
  if (!form.lessonContent.trim()) {
    message.warning("请填写授课内容");
    return;
  }
  if (assignMode.value === "child") {
    if (!form.studentId) {
      message.warning("请选择小孩");
      return;
    }
    const draft = {
      studentId: form.studentId,
      subject: form.subject.trim() || "未分类",
      recordType: form.recordType,
      lessonContent: form.lessonContent.trim(),
      performance: form.performance.trim(),
      homework: form.homework.trim()
    };
    if (editingRecordId.value) {
      workspace.updateClassRecord(editingRecordId.value, draft);
      message.success("课堂记录已更新");
    } else {
      workspace.createClassRecord(draft);
      message.success("课堂记录已保存");
    }
  } else {
    if (!form.groupId) {
      message.warning("请选择班级或分组");
      return;
    }
    const group = workspace.groups.find((g) => g.id === form.groupId);
    if (!group || group.memberIds.length === 0) {
      message.warning("该分组下没有小孩");
      return;
    }
    for (const studentId of group.memberIds) {
      workspace.createClassRecord({
        studentId,
        subject: form.subject.trim() || "未分类",
        recordType: form.recordType,
        lessonContent: form.lessonContent.trim(),
        performance: form.performance.trim(),
        homework: form.homework.trim()
      });
    }
    message.success(`课堂记录已为该分组 ${group.memberIds.length} 名小孩创建`);
  }
  pageMode.value = "list";
  editingRecordId.value = null;
}

function studentName(studentId: string) {
  return workspace.items.find((child) => child.id === studentId)?.name ?? studentId;
}

function updateGradingStatus(recordId: string, status: GradingStatus) {
  const updated = workspace.updateHomeworkGradingStatus(recordId, status);
  message[updated ? "success" : "warning"](updated ? "批改状态已更新" : "这条记录没有可批改作业");
}

function deleteRecord(recordId: string) {
  confirmDelete({
    content: "确定要删除这条课堂记录吗？",
    onOk: () => {
      const index = workspace.classRecords.findIndex((r) => r.id === recordId);
      if (index !== -1) {
        workspace.classRecords.splice(index, 1);
        message.success("课堂记录已删除");
      } else {
        message.error("删除失败：记录不存在");
      }
    }
  });
}

function goBack() {
  pageMode.value = "list";
  resetForm();
}
</script>

<template>
  <div>
    <div class="page-top">
      <template v-if="pageMode === 'list'">
        <div>
          <h1 class="page-title">课堂记录</h1>
          <p class="page-subtitle">记录授课内容、小孩表现和作业布置</p>
        </div>
        <n-button v-if="props.userRole !== 'parent'" type="primary" @click="openCreateForm">
          <template #icon>
            <Plus :size="16" />
          </template>
          新建课堂记录
        </n-button>
      </template>
      <template v-else>
        <div>
          <h1 class="page-title">{{ editingRecordId ? "编辑课堂记录" : "新建课堂记录" }}</h1>
          <p class="page-subtitle">记录授课内容、小孩表现和作业布置</p>
        </div>
        <n-button secondary @click="goBack">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回记录列表
        </n-button>
      </template>
    </div>

    <!-- ============ 列表页 ============ -->
    <template v-if="pageMode === 'list'">
      <!-- 筛选栏 -->
      <div class="record-filter-bar">
        <div class="filter-group">
          <div class="filter-item">
            <span class="filter-label">类型</span>
            <n-select
              v-model:value="filterType"
              :options="TYPE_OPTIONS"
              placeholder="全部"
              clearable
              size="small"
              :consistent-menu-width="false"
            />
          </div>
          <div class="filter-item">
            <span class="filter-label">科目</span>
            <n-select
              v-model:value="filterSubject"
              :options="availableSubjects.map(s => ({ label: s, value: s }))"
              placeholder="全部"
              clearable
              size="small"
              :consistent-menu-width="false"
            />
          </div>
          <div class="filter-item">
            <span class="filter-label">批改</span>
            <n-select
              v-model:value="filterGrading"
              :options="[{ label: '待批改', value: '待批改' }, { label: '已批改', value: '已批改' }]"
              placeholder="全部"
              clearable
              size="small"
              :consistent-menu-width="false"
            />
          </div>
        </div>

        <div class="filter-right">
          <span class="filter-count" v-if="activeFilterCount > 0">
            筛选 {{ filteredRecords.length }} / {{ workspace.classRecords.length }} 条
          </span>
          <span class="filter-count muted" v-else>
            共 {{ workspace.classRecords.length }} 条记录
          </span>
        </div>
      </div>

      <!-- 记录列表 -->
      <div class="record-list" v-if="filteredRecords.length > 0">
        <div
          v-for="record in filteredRecords"
          :key="record.id"
          class="record-card-item"
        >
          <!-- card-top -->
          <div class="record-card-top">
            <div class="card-left">
              <div class="card-icon-box" :style="{ background: RECORD_TYPE_COLORS[record.recordType] + '18', color: RECORD_TYPE_COLORS[record.recordType] }">
                {{ RECORD_TYPE_ICONS[record.recordType] }}
              </div>
              <div class="card-title-group">
                <span class="card-subject">{{ record.subject }} · {{ record.lessonContent }}</span>
              </div>
            </div>
            <div class="card-tags">
              <span class="record-type-tag" :style="{ background: RECORD_TYPE_COLORS[record.recordType] + '1a', color: RECORD_TYPE_COLORS[record.recordType] }">
                {{ record.recordType }}
              </span>
            </div>
          </div>

          <!-- card-body -->
          <div class="record-card-body">
            <div class="card-info-group">
              <span class="card-student-name">{{ studentName(record.studentId) }}</span>
              <span class="card-preview">{{ record.performance || "未记录表现" }}</span>
            </div>
            <div class="card-meta-group">
              <span class="grading-badge" :class="record.gradingStatus === '待批改' ? 'grading-pending' : 'grading-done'">
                {{ record.gradingStatus }}
              </span>
              <span v-if="record.homework" class="homework-hint">{{ record.homework }}</span>
            </div>
          </div>

          <!-- card-footer -->
          <div class="record-card-footer">
            <span class="card-date">{{ formatDate(record.createdAt) }}</span>
            <div class="card-actions">
              <n-button
                v-if="record.homework"
                size="tiny"
                secondary
                @click="updateGradingStatus(record.id, record.gradingStatus === '待批改' ? '已批改' : '待批改')"
              >
                {{ record.gradingStatus === "待批改" ? "标为已批改" : "重新待批改" }}
              </n-button>
              <n-button v-if="props.userRole !== 'parent'" size="tiny" secondary @click="editRecord(record)">
                编辑
              </n-button>
              <n-button v-if="props.userRole !== 'parent'" size="tiny" type="error" secondary @click="deleteRecord(record.id)">
                <template #icon>
                  <Trash2 :size="12" />
                </template>
                删除
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="record-empty-state">
        <p v-if="workspace.classRecords.length === 0">暂无课堂记录，点击右上角「新建课堂记录」开始记录吧</p>
        <p v-else>当前筛选条件下没有匹配的记录</p>
      </div>
    </template>

    <!-- ============ 表单页 ============ -->
    <template v-else>
      <section class="record-form-page">
        <n-form label-placement="top">
          <!-- 记录归属 -->
          <n-form-item label="记录归属" v-if="!editingRecordId">
            <n-radio-group v-model:value="assignMode">
              <n-radio value="child">单个小孩</n-radio>
              <n-radio value="group">班级/分组</n-radio>
            </n-radio-group>
          </n-form-item>

          <!-- 小孩选择（带头像） -->
          <n-form-item v-if="assignMode === 'child'" label="小孩">
            <div class="child-select-with-avatar">
              <img
                class="child-select-avatar"
                :src="childAvatarSourceFor(workspace.appSettings.themeKey, selectedChild.gender)"
                :alt="`${selectedChild.name}头像`"
              />
              <n-select
                v-model:value="form.studentId"
                :options="childOptions"
                class="child-select-input"
              />
            </div>
          </n-form-item>
          <n-form-item v-else label="班级/分组">
            <n-select v-model:value="form.groupId" :options="groupOptions" placeholder="选择班级或分组" />
          </n-form-item>

          <n-form-item label="科目">
            <n-select v-model:value="form.subject" :options="SUBJECT_OPTIONS" />
          </n-form-item>

          <!-- 类型 Pills - 带 icon -->
          <n-form-item label="类型">
            <div class="type-pills">
              <span
                v-for="type in RECORD_TYPES"
                :key="type"
                class="type-pill"
                :class="{ selected: form.recordType === type }"
                :style="form.recordType === type
                  ? { background: RECORD_TYPE_COLORS[type], borderColor: RECORD_TYPE_COLORS[type] }
                  : { '--pill-color': RECORD_TYPE_COLORS[type] }"
                @click="form.recordType = type"
              >
                <span class="type-pill-icon">{{ RECORD_TYPE_ICONS[type] }}</span>
                {{ type }}
              </span>
            </div>
          </n-form-item>

          <!-- 动态表单字段 -->
          <div class="dynamic-fields-section">
            <n-form-item
              v-for="field in dynamicFields"
              :key="field.key"
              :label="field.label"
              :required="field.required"
            >
              <n-input
                v-if="field.type === 'input'"
                v-model:value="form[field.bindTo]"
                :placeholder="field.placeholder"
              />
              <n-input
                v-else
                v-model:value="form[field.bindTo]"
                type="textarea"
                :placeholder="field.placeholder"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </n-form-item>
          </div>

          <p v-if="assignMode === 'group'" class="muted-text">选择班级或分组后，记录将自动为该分组内的所有小孩创建。</p>

          <!-- 底部按钮 -->
          <div class="form-actions-bar">
            <n-space>
              <n-button type="primary" @click="saveRecord">
                {{ editingRecordId ? "更新课堂记录" : "保存课堂记录" }}
              </n-button>
              <n-button secondary @click="goBack">取消</n-button>
            </n-space>
          </div>
        </n-form>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ===== 筛选栏 ===== */
.record-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
  min-width: 28px;
}

.filter-item :deep(.n-base-selection) {
  min-width: 110px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-strong);
  white-space: nowrap;
}

.filter-count.muted {
  color: var(--muted);
}

/* ===== 记录卡片 ===== */
.record-list {
  display: grid;
  gap: 12px;
}

.record-card-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: 16px;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  display: grid;
  gap: 10px;
}

.record-card-item:hover {
  border-color: color-mix(in srgb, var(--primary) 28%, var(--border));
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.record-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.card-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  font-size: 18px;
  flex-shrink: 0;
}

.card-title-group {
  min-width: 0;
}

.card-subject {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.record-type-tag {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.record-card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-info-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-student-name {
  font-size: 13px;
  color: var(--muted-strong);
  font-weight: 600;
}

.card-preview {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.card-meta-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.grading-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.grading-pending {
  background: #fee2e2;
  color: #ef4444;
}

.grading-done {
  background: #d1fae5;
  color: #059669;
}

.homework-hint {
  font-size: 11px;
  color: var(--muted);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.card-date {
  font-size: 12px;
  color: var(--muted);
}

.card-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* ===== 空状态 ===== */
.record-empty-state {
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
}

/* ===== 表单页 ===== */
.record-form-page {
  width: 100%;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: 28px 32px;
}

/* ===== 小孩选择带头像 ===== */
.child-select-with-avatar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.child-select-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1.5px solid color-mix(in srgb, var(--primary) 22%, var(--border));
  object-fit: cover;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.child-select-input {
  flex: 1;
  min-width: 0;
}

/* ===== 类型 Pills ===== */
.type-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid var(--border);
  background: var(--panel-solid);
  color: var(--muted-strong);
  user-select: none;
}

.type-pill-icon {
  font-size: 13px;
  line-height: 1;
}

.type-pill:hover {
  border-color: var(--pill-color, var(--primary));
  color: var(--pill-color, var(--primary-strong));
}

.type-pill.selected {
  color: #fff;
  border-color: transparent;
}

/* ===== 动态字段区域 ===== */
.dynamic-fields-section {
  padding: 18px 20px;
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primary);
  background: var(--primary-soft);
  margin-top: 8px;
  display: grid;
  gap: 4px;
}

/* ===== 底部按钮 ===== */
.form-actions-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  margin-top: 8px;
  border-top: 1px solid var(--border);
}
</style>
