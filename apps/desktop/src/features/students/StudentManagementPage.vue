<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, CalendarCheck2, FileImage, FileText, NotebookPen, Plus, Sparkles, UserRound } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useMessage } from "naive-ui";
import { computed, reactive, ref, watch } from "vue";
import { analyzeMistakeStream, generateSimilarQuestionsStream } from "../mistake-book/mistakeApi";
import { studentAvatarSourceFor } from "../../shared/assets/studentAvatars";
import { buildMistakeBookSubjectOptions, mistakeBookSubjectCountText } from "./mistakeBookPanel";
import type { Course, Student, StudentGroup } from "./studentStore";
import { GROUP_COLORS, K12_MISTAKE_BOOK_SUBJECTS, useStudentStore } from "./studentStore";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";

const students = useStudentStore();
const props = defineProps<{
  initialMode?: "list" | "detail" | "mistakeBook";
}>();
const { activeStudent } = storeToRefs(students);
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const showStudentModal = ref(false);
const editingStudentId = ref<string | null>(null);
const selectedMistakeImagePath = ref("");
const mistakeQuestionText = ref("");
const mistakeInputMode = ref<"text" | "image">("text");
const streamingAnalysisText = ref("");
const streamingSimilarQuestionsText = ref("");
const isAnalyzingMistake = ref(false);
const isGeneratingSimilarQuestions = ref(false);
const pageMode = ref<"list" | "detail" | "mistakeBook" | "groupManage">("list");
const activeMistakeSubject = ref("");
const selectedGroupId = ref<string | null>(null);
const showGroupModal = ref(false);
const editingGroupId = ref<string | null>(null);
const groupForm = reactive({
  name: "",
  description: "",
  type: "class" as "class" | "subject",
  color: GROUP_COLORS[0],
  subjects: [] as string[],
  memberIds: [] as string[]
});
const form = reactive({
  name: "",
  gender: "female" as Student["gender"],
  goal: "",
  style: "",
  courses: [] as Course[],
  materialsText: "",
  groupIds: [] as string[]
});
const modalTitle = computed(() => (editingStudentId.value ? "编辑学生" : "新增学生"));
const mistakeSubjectOptions = computed(() => buildMistakeBookSubjectOptions(activeStudent.value.mistakeBook.subjects));
const activeMistakeSubjectLabel = computed(() => activeMistakeSubject.value || activeStudent.value.mistakeBook.subjects[0]);
const mistakeSubjectCount = computed(() => mistakeBookSubjectCountText(activeStudent.value.mistakeBook.subjects));
const readableStreamingAnalysis = computed(() => streamingAnalysisText.value.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim());
const readableStreamingSimilarQuestions = computed(() => streamingSimilarQuestionsText.value.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim());
const activeStudentPlans = computed(() =>
  students.calendarPlanItems.filter((item) => item.studentId === activeStudent.value.id).slice(0, 3)
);
const activeStudentReport = computed(() =>
  students.learningReports.find((report) => report.studentId === activeStudent.value.id)
);
const courseSubjectOptions = computed(() => {
  return K12_MISTAKE_BOOK_SUBJECTS.map((subject) => ({ label: subject, value: subject }));
});
const genderOptions = [
  { label: "女生", value: "female" },
  { label: "男生", value: "male" }
];
const filteredStudents = computed(() => {
  if (!selectedGroupId.value) return students.items;
  const group = students.groups.find((g) => g.id === selectedGroupId.value);
  if (!group) return students.items;
  return students.items.filter((s) => group.memberIds.includes(s.id));
});
const treeItems = computed(() => {
  const items: Array<{ key: string; label: string; count: number; type: "all" | "class" | "subject" | "ungrouped"; group?: StudentGroup }> = [];
  items.push({ key: "all", label: "全部学生", count: students.items.length, type: "all" });
  if (students.classes.length > 0) {
    items.push(...students.classes.map((g) => ({
      key: g.id,
      label: g.name,
      count: g.memberIds.length,
      type: "class" as const,
      group: g
    })));
  }
  if (students.subjectGroups.length > 0) {
    items.push(...students.subjectGroups.map((g) => ({
      key: g.id,
      label: g.name,
      count: g.memberIds.length,
      type: "subject" as const,
      group: g
    })));
  }
  const ungCount = students.ungroupedStudents.length;
  if (ungCount > 0) {
    items.push({ key: "ungrouped", label: "未分组", count: ungCount, type: "ungrouped" });
  }
  return items;
});

watch(
  () => props.initialMode,
  (mode) => {
    if (!mode) return;
    pageMode.value = mode;
    if (mode === "mistakeBook") {
      activeMistakeSubject.value = students.activeStudent.mistakeBook.subjects[0] ?? "";
    }
  },
  { immediate: true }
);

function parseList(text: string) {
  return text
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resetForm(student?: Student) {
  editingStudentId.value = student?.id ?? null;
  form.name = student?.name ?? "";
  form.gender = student?.gender ?? "female";
  form.goal = student?.goal ?? "";
  form.style = student?.style ?? "";
  form.courses = student
    ? student.courses.map((course) => ({ ...course }))
    : [{ subject: "数学", currentLesson: 0, totalLessons: 12, progress: 0 }];
  form.materialsText = student?.materials.join("\n") ?? "";
  form.groupIds = student ? students.groups.filter((g) => g.memberIds.includes(student.id)).map((g) => g.id) : [];
}

function openCreateStudent() {
  resetForm();
  showStudentModal.value = true;
}

function openEditStudent(student: Student) {
  resetForm(student);
  showStudentModal.value = true;
}

function saveStudent() {
  if (!form.name.trim()) {
    message.warning("请填写学生姓名");
    return;
  }
  const courses = form.courses
    .map((course) => ({
      subject: course.subject.trim(),
      currentLesson: Number(course.currentLesson) || 0,
      totalLessons: Number(course.totalLessons) || 1,
      progress: 0
    }))
    .filter((course) => course.subject);
  if (courses.length === 0) {
    message.warning("请至少添加一门课程");
    return;
  }
  const draft = {
    name: form.name.trim(),
    gender: form.gender,
    goal: form.goal.trim() || "待设定目标",
    style: form.style.trim() || "待观察学习风格",
    courses,
    materials: parseList(form.materialsText)
  };
  if (editingStudentId.value) {
    students.updateStudent(editingStudentId.value, draft);
    // Update group memberships
    const studentId = editingStudentId.value;
    const prevGroupIds = students.groups.filter((g) => g.memberIds.includes(studentId)).map((g) => g.id);
    for (const gid of prevGroupIds) {
      if (!form.groupIds.includes(gid)) students.removeStudentFromGroup(gid, studentId);
    }
    for (const gid of form.groupIds) {
      if (!prevGroupIds.includes(gid)) students.addStudentToGroup(gid, studentId);
    }
    message.success("学生信息已更新");
  } else {
    students.createStudent(draft);
    const newStudentId = students.activeStudentId;
    for (const gid of form.groupIds) {
      students.addStudentToGroup(gid, newStudentId);
    }
    message.success("学生已新增");
  }
  showStudentModal.value = false;
}

function addCourseDraft() {
  form.courses.push({ subject: "", currentLesson: 0, totalLessons: 12, progress: 0 });
}

function removeCourseDraft(index: number) {
  if (form.courses.length <= 1) {
    message.warning("至少保留一门课程");
    return;
  }
  form.courses.splice(index, 1);
}

function courseProgress(course: Course) {
  const totalLessons = Math.max(Number(course.totalLessons) || 1, 1);
  const currentLesson = Math.min(Math.max(Number(course.currentLesson) || 0, 0), totalLessons);
  return Math.min(Math.round((currentLesson / totalLessons) * 100), 100);
}

function studentAvatar(student: Student) {
  return studentAvatarSourceFor(students.appSettings.themeKey, student.gender);
}

function formatStudentPlanTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function checkInCourse(studentId: string, subject: string) {
  const checked = students.checkInStudentCourse(studentId, subject);
  message[checked ? "success" : "warning"](checked ? `${subject} 已完成 1 节课打卡` : `${subject} 已完成全部课时或不存在`);
}

function undoCourseCheckIn(studentId: string, subject: string) {
  const undone = students.undoStudentCourseCheckIn(studentId, subject);
  message[undone ? "success" : "warning"](undone ? `${subject} 已撤回 1 节课打卡` : `${subject} 暂无可撤回课时或不存在`);
}

function removeStudent(studentId: string) {
  const student = students.items.find((s) => s.id === studentId);
  if (!student) return;
  confirmDelete({
    content: `确定要删除学生「${student.name}」吗？该学生的所有课堂记录、提醒和课程也将一并删除。`,
    onOk: () => {
      const deleted = students.deleteStudent(studentId);
      if (deleted) {
        message.success("学生已删除");
      } else {
        message.warning("至少保留一个学生档案");
      }
    }
  });
}

function openStudentDetail(studentId: string) {
  students.selectStudent(studentId);
  pageMode.value = "detail";
}

function openMistakeBook(studentId: string) {
  students.selectStudent(studentId);
  activeMistakeSubject.value = students.activeStudent.mistakeBook.subjects[0] ?? "";
  pageMode.value = "mistakeBook";
  message.info("已打开学生错题本");
}

async function runAiAnalysis() {
  const questionText = mistakeQuestionText.value.trim();
  const imagePath = mistakeInputMode.value === "image" ? selectedMistakeImagePath.value : "";
  if (mistakeInputMode.value === "text" && !questionText) {
    message.warning("请输入题目内容");
    return;
  }
  if (mistakeInputMode.value === "image" && !imagePath) {
    message.warning("请先上传错题图片");
    return;
  }
  isAnalyzingMistake.value = true;
  streamingAnalysisText.value = "";
  try {
    const result = await analyzeMistakeStream({
      studentId: activeStudent.value.id,
      subject: activeMistakeSubject.value || activeStudent.value.mistakeBook.subjects[0],
      questionText,
      studentAnswer: "学生答案待补充",
      imagePath: imagePath || undefined
    }, (_delta, fullContent) => {
      streamingAnalysisText.value = fullContent;
    });
    students.updateMistakeAnalysis(activeStudent.value.id, {
      analysis: result.mistakeReason,
      knowledgeInsight: result.knowledgePoints.join("、"),
      aiPending: Math.max(activeStudent.value.mistakeBook.aiPending - 1, 0)
    });
    message.success("AI 已生成待教师确认的错题分析");
  } catch (error) {
    message.error(`AI 分析失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isAnalyzingMistake.value = false;
  }
}

async function runGenerateSimilarQuestions() {
  const questionText = mistakeQuestionText.value.trim();
  if (!questionText) {
    message.warning("请先输入题目内容");
    return;
  }
  isGeneratingSimilarQuestions.value = true;
  streamingSimilarQuestionsText.value = "";
  try {
    const questions = await generateSimilarQuestionsStream({
      studentId: activeStudent.value.id,
      subject: activeMistakeSubject.value || activeStudent.value.mistakeBook.subjects[0],
      questionText,
      studentAnswer: "学生答案待补充"
    }, (_delta, fullContent) => {
      streamingSimilarQuestionsText.value = fullContent;
    });
    students.updateMistakeAnalysis(activeStudent.value.id, {
      similarQuestions: questions.join("，"),
      aiPending: Math.max(activeStudent.value.mistakeBook.aiPending - 1, 0)
    });
    message.success("已生成类似题型建议");
  } catch (error) {
    message.error(`生成失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isGeneratingSimilarQuestions.value = false;
  }
}

async function chooseMistakeImageAndAnalyze() {
  mistakeInputMode.value = "image";
  if (!isTauri()) {
    message.info("Web 预览环境请在桌面端上传错题图片");
    return;
  }
  const selected = await open({
    multiple: false,
    filters: [{ name: "错题图片", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (typeof selected !== "string") return;
  selectedMistakeImagePath.value = selected;
  await runAiAnalysis();
}

function switchMistakeInputMode(mode: "text" | "image") {
  mistakeInputMode.value = mode;
  if (mode === "text") {
    selectedMistakeImagePath.value = "";
  } else {
    mistakeQuestionText.value = "";
  }
  streamingAnalysisText.value = "";
  streamingSimilarQuestionsText.value = "";
}

// --- Group management ---

function studentGroupsFor(studentId: string) {
  return students.studentGroupsFor(studentId);
}

function openGroupManage() {
  pageMode.value = "groupManage";
}

function openCreateGroup(type: "class" | "subject") {
  editingGroupId.value = null;
  groupForm.name = "";
  groupForm.description = "";
  groupForm.type = type;
  groupForm.color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
  groupForm.subjects = [];
  groupForm.memberIds = [];
  showGroupModal.value = true;
}

function openEditGroup(group: StudentGroup) {
  editingGroupId.value = group.id;
  groupForm.name = group.name;
  groupForm.description = group.description;
  groupForm.type = group.type;
  groupForm.color = group.color;
  groupForm.subjects = [...group.subjects];
  groupForm.memberIds = [...group.memberIds];
  showGroupModal.value = true;
}

function saveGroup() {
  if (!groupForm.name.trim()) {
    message.warning("请填写分组名称");
    return;
  }
  if (editingGroupId.value) {
    students.updateGroup(editingGroupId.value, {
      name: groupForm.name.trim(),
      description: groupForm.description.trim(),
      type: groupForm.type,
      color: groupForm.color,
      subjects: groupForm.type === "subject" ? groupForm.subjects : []
    });
    // Sync members
    const groupId = editingGroupId.value;
    const group = students.groups.find((g) => g.id === groupId)!;
    const prevIds = [...group.memberIds];
    for (const sid of prevIds) {
      if (!groupForm.memberIds.includes(sid)) students.removeStudentFromGroup(groupId, sid);
    }
    for (const sid of groupForm.memberIds) {
      if (!prevIds.includes(sid)) students.addStudentToGroup(groupId, sid);
    }
    message.success("分组已更新");
  } else {
    students.createGroup({
      name: groupForm.name.trim(),
      description: groupForm.description.trim(),
      type: groupForm.type,
      color: groupForm.color,
      subjects: groupForm.type === "subject" ? groupForm.subjects : [],
      memberIds: groupForm.memberIds
    });
    message.success("分组已创建");
  }
  showGroupModal.value = false;
}

function deleteGroup(groupId: string) {
  const group = students.groups.find((g) => g.id === groupId);
  if (!group) return;
  confirmDelete({
    content: `确定要删除分组「${group.name}」吗？该分组下的学生不会受影响。`,
    onOk: () => {
      students.deleteGroup(groupId);
      message.success("分组已删除");
    }
  });
}

function toggleStudentInGroup(groupId: string, studentId: string) {
  const group = students.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (group.memberIds.includes(studentId)) {
    students.removeStudentFromGroup(groupId, studentId);
  } else {
    students.addStudentToGroup(groupId, studentId);
  }
}

// For group member management inside groupManage page
const groupMemberDraft = ref<Record<string, string[]>>({});

function initGroupMemberDraft(group: StudentGroup) {
  groupMemberDraft.value[group.id] = [...group.memberIds];
}

function toggleMemberDraft(groupId: string, studentId: string) {
  const draft = groupMemberDraft.value[groupId];
  if (!draft) return;
  const idx = draft.indexOf(studentId);
  if (idx >= 0) {
    draft.splice(idx, 1);
  } else {
    draft.push(studentId);
  }
}

function saveGroupMembers(groupId: string) {
  const draft = groupMemberDraft.value[groupId];
  if (!draft) return;
  const group = students.groups.find((g) => g.id === groupId);
  if (!group) return;
  group.memberIds = [...draft];
  message.success("成员已更新");
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">学生管理</h1>
        <p class="page-subtitle">卡片化管理学生、多学科课程、错题本和 AI 分析入口</p>
      </div>
      <n-button type="primary" @click="openCreateStudent">
        <template #icon>
          <Plus :size="16" />
        </template>
        新增学生
      </n-button>
    </div>

    <section v-if="pageMode === 'list'" class="student-management-page">
      <aside class="group-sidebar">
        <div class="group-sidebar-header">
          <UsersRound :size="16" />
          <span>学生列表</span>
        </div>
        <nav class="group-tree">
          <button
            v-for="item in treeItems"
            :key="item.key"
            class="group-tree-item"
            :class="{
              active: selectedGroupId === item.key,
              'group-type-class': item.type === 'class',
              'group-type-subject': item.type === 'subject',
            }"
            :style="item.group && item.group.color ? { '--group-color': item.group.color } : {}"
            @click="selectedGroupId = item.key === 'all' ? null : (item.type === 'ungrouped' ? 'ungrouped' : item.key)"
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
        </nav>
      </aside>

      <section class="student-grid">
        <article v-for="student in students.items" :key="student.id" class="student-card">
          <header>
            <img class="student-card-avatar" :src="studentAvatar(student)" :alt="`${student.name}头像`" />
            <div>
              <h2>{{ student.name }}</h2>
              <p>{{ student.gender === "male" ? "男生" : "女生" }} · 目标：{{ student.goal }} · 风格：{{ student.style }}</p>
            </div>
          </header>

          <div class="course-list">
            <div v-for="course in student.courses" :key="course.subject" class="course-row">
              <n-space justify="space-between" align="center">
                <strong>{{ course.subject }} · 第 {{ course.currentLesson }}/{{ course.totalLessons }} 节 · {{ course.progress }}%</strong>
                <n-space size="small">
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson >= course.totalLessons"
                    @click="checkInCourse(student.id, course.subject)"
                  >
                    打卡
                  </n-button>
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson <= 0"
                    @click="undoCourseCheckIn(student.id, course.subject)"
                  >
                    撤回
                  </n-button>
                </n-space>
              </n-space>
              <n-progress type="line" :percentage="course.progress" :show-indicator="false" :height="7" color="var(--primary)" />
            </div>
          </div>

          <p>已分配资料：{{ students.materialTitlesForStudent(student.id).join("、") || "未分配" }}</p>

          <div class="mistake-entry">
            <strong>{{ student.mistakeBook.summary }}</strong>
            <div class="mistake-focus-summary" aria-label="错题本概览">
              <span>覆盖 {{ student.mistakeBook.subjects.length }} 科</span>
              <span>AI 待处理 {{ student.mistakeBook.aiPending }} 题</span>
            </div>
            <p>重点薄弱点：{{ student.mistakeBook.weakPoints.slice(0, 3).join("、") }}</p>
            <n-button type="primary" strong @click="openMistakeBook(student.id)">
              <template #icon>
                <NotebookPen :size="16" />
              </template>
              进入错题本
            </n-button>
          </div>

          <n-space>
            <n-button size="small" secondary @click="openStudentDetail(student.id)">查看</n-button>
            <n-button size="small" secondary @click="openEditStudent(student)">编辑</n-button>
            <n-button size="small" secondary type="error" @click="removeStudent(student.id)">删除</n-button>
          </n-space>
        </article>
      </section>
    </section>

    <section v-else-if="pageMode === 'groupManage'" class="group-manage-page">
      <div class="student-page-toolbar">
        <n-button secondary @click="pageMode = 'list'; selectedGroupId = null">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回学生列表
        </n-button>
        <n-space style="margin-left: auto;">
          <n-button size="small" secondary @click="openCreateGroup('class')">
            <template #icon><Plus :size="14" /></template>新建分组
          </n-button>
        </n-space>
      </div>

      <div v-if="students.groups.length === 0" class="list-empty-state">暂无分组，点击上方按钮创建</div>
      <div class="group-manage-grid">
        <div v-for="group in students.groups" :key="group.id" class="group-manage-card">
          <div class="group-manage-card-header">
            <span class="group-color-dot" :style="{ background: group.color }" />
            <strong>{{ group.name }}</strong>
            <span class="group-type-badge">{{ group.type === "class" ? "班级" : "科目" }}</span>
            <span class="group-count-badge">{{ group.memberIds.length }} 人</span>
          </div>
          <p class="group-desc">{{ group.description || "暂无描述" }}</p>
          <div v-if="group.type === 'subject' && group.subjects.length > 0" class="group-tags" style="margin-top:4px;">
            <span v-for="sub in group.subjects" :key="sub" class="group-tag" :style="{ '--tag-color': group.color }">{{ sub }}</span>
          </div>
          <div class="group-manage-actions">
            <n-button size="tiny" secondary @click="openEditGroup(group)">编辑</n-button>
            <n-button size="tiny" secondary type="error" @click="deleteGroup(group.id)">删除</n-button>
          </div>
        </div>
      </div>
    </section>

    <section v-else class="student-detail-page">
      <div class="student-page-toolbar">
        <n-button secondary @click="pageMode = 'list'">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回学生列表
        </n-button>
      </div>

      <section class="side-panel student-detail-panel">
        <template v-if="pageMode === 'detail'">
          <div class="panel-heading">
            <UserRound :size="18" />
            <h2>{{ activeStudent.name }} · 学生详情</h2>
          </div>
          <div class="detail-list">
            <div>
              <span>学习目标</span>
              <strong>{{ activeStudent.goal }}</strong>
            </div>
            <div>
              <span>学习风格</span>
              <strong>{{ activeStudent.style }}</strong>
            </div>
            <div>
              <span>已分配资料</span>
              <strong>{{ students.materialTitlesForStudent(activeStudent.id).join("、") || "未分配" }}</strong>
            </div>
          </div>
          <div class="course-list">
            <div v-for="course in activeStudent.courses" :key="course.subject" class="course-row">
              <n-space justify="space-between" align="center">
                <strong>{{ course.subject }} · 第 {{ course.currentLesson }}/{{ course.totalLessons }} 节 · {{ course.progress }}%</strong>
                <n-space size="small">
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson >= course.totalLessons"
                    @click="checkInCourse(activeStudent.id, course.subject)"
                  >
                    打卡
                  </n-button>
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson <= 0"
                    @click="undoCourseCheckIn(activeStudent.id, course.subject)"
                  >
                    撤回
                  </n-button>
                </n-space>
              </n-space>
              <n-progress type="line" :percentage="course.progress" :show-indicator="false" :height="7" color="var(--primary)" />
            </div>
          </div>
          <section class="student-follow-section">
            <div class="panel-heading compact">
              <CalendarCheck2 :size="17" />
              <h3>学习计划</h3>
            </div>
            <div v-if="activeStudentPlans.length === 0" class="detail-empty">暂无计划或提醒</div>
            <div v-for="plan in activeStudentPlans" :key="`${plan.type}-${plan.id}`" class="student-follow-item">
              <strong>{{ formatStudentPlanTime(plan.time) }} · {{ plan.title }}</strong>
              <span>{{ plan.type }} · {{ plan.detail }}</span>
            </div>
          </section>
          <section class="student-follow-section">
            <div class="panel-heading compact">
              <FileText :size="17" />
              <h3>学习报告</h3>
            </div>
            <div v-if="activeStudentReport" class="student-follow-item">
              <strong>平均进度 {{ activeStudentReport.averageProgress }}% · 作业 {{ activeStudentReport.homeworkCount }} 项</strong>
              <span>课堂记录 {{ activeStudentReport.classRecordCount }} 条 · 待批改 {{ activeStudentReport.pendingGradingCount }} 项</span>
              <span>下一步：{{ activeStudentReport.nextActions.join("；") }}</span>
            </div>
          </section>
          <section class="student-follow-section">
            <div class="panel-heading compact">
              <UsersRound :size="17" />
              <h3>所属分组</h3>
            </div>
            <div v-if="studentGroupsFor(activeStudent.id).length === 0" class="detail-empty">未加入任何分组</div>
            <div v-for="g in studentGroupsFor(activeStudent.id)" :key="g.id" class="student-follow-item">
              <span class="group-tag" :style="{ '--tag-color': g.color }">{{ g.type === "class" ? "班级" : "科目" }} · {{ g.name }}</span>
            </div>
          </section>
          <n-button type="primary" @click="pageMode = 'mistakeBook'">
            <template #icon>
              <NotebookPen :size="16" />
            </template>
            查看错题本
          </n-button>
        </template>

        <template v-else>
          <h2>{{ activeStudent.name }} · AI 错题本</h2>
          <div class="mistake-subject-summary">
            <div>
              <span>{{ mistakeSubjectCount }}</span>
              <strong>{{ activeStudent.mistakeBook.summary }}</strong>
            </div>
            <p>AI 待处理 {{ activeStudent.mistakeBook.aiPending }} 题</p>
          </div>

          <n-form-item label="当前科目">
            <n-select v-model:value="activeMistakeSubject" :options="mistakeSubjectOptions" />
          </n-form-item>

          <div class="mistake-input-card">
            <div class="mistake-input-tabs" aria-label="题目内容录入方式">
              <button
                type="button"
                :class="{ active: mistakeInputMode === 'text' }"
                @click="switchMistakeInputMode('text')"
              >
                手动输入
              </button>
              <button
                type="button"
                :class="{ active: mistakeInputMode === 'image' }"
                @click="switchMistakeInputMode('image')"
              >
                上传图片改题
              </button>
            </div>
            <n-form-item v-if="mistakeInputMode === 'text'" label="题目内容">
              <n-input
                v-model:value="mistakeQuestionText"
                type="textarea"
                placeholder="手动输入错题内容"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </n-form-item>
            <div v-else class="mistake-image-input">
              <n-button type="primary" @click="chooseMistakeImageAndAnalyze" style="width:100%">
                <template #icon>
                  <FileImage :size="16" />
                </template>
                {{ selectedMistakeImagePath ? "重新选择错题图片" : "选择错题图片并分析" }}
              </n-button>
              <p class="muted-text">{{ selectedMistakeImagePath ? `已选择图片：${selectedMistakeImagePath}` : "支持 png、jpg、jpeg、webp" }}</p>
            </div>
          </div>

          <n-space vertical>
            <div class="mistake-action-section">
              <n-button type="primary" :loading="isAnalyzingMistake" @click="runAiAnalysis" style="width:100%">
                <Sparkles :size="15" />
                AI 分析
              </n-button>
              <div class="ai-note mistake-analysis-output">
                <template v-if="streamingAnalysisText || isAnalyzingMistake">
                  <p>
                    <Sparkles :size="15" />
                    <span class="streaming-analysis-text">{{ readableStreamingAnalysis || "正在等待模型返回…" }}</span>
                  </p>
                </template>
                <template v-else>
                  <p><Sparkles :size="15" /> {{ activeMistakeSubjectLabel }}错误分析：{{ activeStudent.mistakeBook.analysis }}</p>
                  <p>知识点分析：{{ activeStudent.mistakeBook.knowledgeInsight }}</p>
                </template>
              </div>
            </div>
            <div class="mistake-action-section">
              <n-button type="primary" :loading="isGeneratingSimilarQuestions" @click="runGenerateSimilarQuestions" style="width:100%">
                <FileText :size="15" />
                出类似题
              </n-button>
              <div class="ai-note mistake-analysis-output similar-question-output">
                <p>
                  <FileText :size="15" />
                  <span class="streaming-analysis-text">
                    {{ readableStreamingSimilarQuestions || (isGeneratingSimilarQuestions ? "正在等待模型返回…" : `类似题型：${activeStudent.mistakeBook.similarQuestions}`) }}
                  </span>
                </p>
              </div>
            </div>
          </n-space>
        </template>
      </section>
    </section>

    <n-modal v-model:show="showStudentModal" preset="card" :title="modalTitle" class="form-modal">
      <n-form label-placement="top">
        <n-form-item label="学生姓名">
          <n-input v-model:value="form.name" placeholder="例如：陈一诺" />
        </n-form-item>
        <n-form-item label="性别">
          <n-select v-model:value="form.gender" :options="genderOptions" />
        </n-form-item>
        <n-form-item label="学习目标">
          <n-input v-model:value="form.goal" placeholder="例如：期中数学 90+" />
        </n-form-item>
        <n-form-item label="学习风格">
          <n-input v-model:value="form.style" placeholder="例如：图像化讲解 + 例题驱动" />
        </n-form-item>
        <n-form-item label="课程信息">
          <div class="structured-course-editor">
            <div v-for="(course, index) in form.courses" :key="index" class="structured-course-row">
              <n-select
                v-model:value="course.subject"
                :options="courseSubjectOptions"
                filterable
                tag
                placeholder="选择科目"
              />
              <n-input-number
                v-model:value="course.currentLesson"
                :min="0"
                :max="Math.max(Number(course.totalLessons) || 1, 1)"
                placeholder="已完成"
              />
              <n-input-number v-model:value="course.totalLessons" :min="1" placeholder="总课时" />
              <div class="course-progress-preview">{{ courseProgress(course) }}%</div>
              <n-button size="small" secondary type="error" @click="removeCourseDraft(index)">删除</n-button>
            </div>
            <n-button secondary @click="addCourseDraft">添加课程</n-button>
            <p class="muted-text">进度由已完成课时 / 总课时自动计算，保存时不会使用手填百分比。</p>
          </div>
        </n-form-item>
        <n-form-item label="已分配资料">
          <n-input
            v-model:value="form.materialsText"
            type="textarea"
            placeholder="每行一个资料名称"
            :autosize="{ minRows: 2, maxRows: 5 }"
          />
        </n-form-item>
        <n-form-item v-if="students.groups.length > 0" label="所属分组">
          <n-select
            v-model:value="form.groupIds"
            :options="students.groups.map((g) => ({ label: `${g.name}（${g.type === 'class' ? '班级' : '科目'}）`, value: g.id }))"
            multiple
            filterable
            placeholder="选择所属分组"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showStudentModal = false">取消</n-button>
          <n-button type="primary" @click="saveStudent">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showGroupModal" preset="card" :title="groupModalTitle" class="form-modal">
      <n-form label-placement="top">
        <n-form-item label="分组名称">
          <n-input v-model:value="groupForm.name" :placeholder="groupForm.type === 'class' ? '例如：周六数学班' : '例如：竞赛突击组'" />
        </n-form-item>
        <n-form-item label="描述">
          <n-input v-model:value="groupForm.description" type="textarea" placeholder="可选描述" :autosize="{ minRows: 1, maxRows: 2 }" />
        </n-form-item>
        <n-form-item label="类型">
          <n-radio-group v-model:value="groupForm.type" :disabled="!!editingGroupId">
            <n-radio value="class">班级</n-radio>
            <n-radio value="subject">科目分组</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item v-if="groupForm.type === 'subject'" label="关联科目（多选）">
          <n-select
            v-model:value="groupForm.subjects"
            :options="courseSubjectOptions"
            multiple
            filterable
            placeholder="选择关联科目"
          />
        </n-form-item>
        <n-form-item label="颜色标签">
          <div class="color-picker-row">
            <button
              v-for="c in GROUP_COLORS"
              :key="c"
              class="color-swatch"
              :class="{ active: groupForm.color === c }"
              :style="{ background: c }"
              @click="groupForm.color = c"
            />
          </div>
        </n-form-item>
        <n-form-item label="添加成员（多选）">
          <n-select
            v-model:value="groupForm.memberIds"
            :options="students.items.map((s) => ({ label: s.name, value: s.id }))"
            multiple
            filterable
            placeholder="选择学生"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showGroupModal = false">取消</n-button>
          <n-button type="primary" @click="saveGroup">保存</n-button>
        </n-space>
      </template>
    </n-modal>


  </div>
</template>
