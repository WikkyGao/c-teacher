<script setup lang="ts">
import { isTauri, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, CalendarCheck2, FileImage, FileText, NotebookPen, Pencil, Plus, Settings2, Smartphone, Sparkles, UserRound, UsersRound } from "lucide-vue-next";
import MobileConnectModal from "../mobile/MobileConnectModal.vue";
import { storeToRefs } from "pinia";
import { useMessage } from "naive-ui";
import { computed, reactive, ref, watch } from "vue";
import { analyzeMistakeStream, generateSimilarQuestionsStream } from "../mistake-book/mistakeApi";
import { childAvatarSourceFor } from "../../shared/assets/childAvatars";
import { buildMistakeBookSubjectOptions, mistakeBookSubjectCountText } from "./mistakeBookPanel";
import MistakeBookPage from "../mistake-book/MistakeBookPage.vue";
import type { Child, ChildGroup, Course, MistakeRecord } from "./childStore";
import { GROUP_COLORS, K12_MISTAKE_BOOK_SUBJECTS, useChildStore } from "./childStore";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import { childLabel } from "../../shared/utils/childLabel";

const students = useChildStore();
import type { UserRole } from "../auth/authSession";

const props = defineProps<{
  initialMode?: "list" | "detail" | "mistakeBook";
  userRole?: UserRole;
}>();
const { activeChild, defaultAiModel } = storeToRefs(students);
const cl = computed(() => childLabel(props.userRole));
const modelSupportsVision = computed(() => defaultAiModel.value?.supportsVision ?? false);
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const editingStudentId = ref<string | null>(null);
const selectedMistakeImagePath = ref("");
const selectedMistakeImageDataUrl = ref("");
const showImagePreview = ref(false);
const mistakeQuestionText = ref("");
const mistakeInputMode = ref<"text" | "image">("text");
const streamingAnalysisText = ref("");
const streamingSimilarQuestionsText = ref("");
const showMobileConnectModal = ref(false);
const isAnalyzingMistake = ref(false);
const isGeneratingSimilarQuestions = ref(false);
const pageMode = ref<"list" | "detail" | "edit" | "mistakeBook" | "groupManage">("list");
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
const showMistakeDetailModal = ref(false);
const selectedMistakeRecord = ref<MistakeRecord | null>(null);
const form = reactive({
  name: "",
  gender: "female" as Child["gender"],
  goal: "",
  style: "",
  groupIds: [] as string[],
  reportNotes: ""
});
const modalTitle = computed(() => (editingStudentId.value ? `编辑${cl.value}` : `新增${cl.value}`));
const groupModalTitle = computed(() => (editingGroupId.value ? "编辑分组" : "新建分组"));
const mistakeSubjectOptions = computed(() => buildMistakeBookSubjectOptions(activeChild.value.mistakeBook.subjects));
const activeMistakeSubjectLabel = computed(() => activeMistakeSubject.value || activeChild.value.mistakeBook.subjects[0]);
const mistakeSubjectCount = computed(() => mistakeBookSubjectCountText(activeChild.value.mistakeBook.subjects));
const readableStreamingAnalysis = computed(() => streamingAnalysisText.value.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim());
const readableStreamingSimilarQuestions = computed(() => streamingSimilarQuestionsText.value.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim());
const activeStudentPlans = computed(() =>
  students.calendarPlanItems.filter((item) => item.studentId === activeChild.value.id).slice(0, 3)
);
const activeStudentReport = computed(() =>
  students.learningReports.find((report) => report.studentId === activeChild.value.id)
);
const activeStudentMaterials = computed(() => students.materialsForStudent(activeChild.value.id));
const activeStudentCourses = computed(() => students.getStudentCourses(activeChild.value.id));
function getChildCourses(childId: string) {
  return students.getStudentCourses(childId);
}
const courseSubjectOptions = computed(() => {
  return K12_MISTAKE_BOOK_SUBJECTS.map((subject) => ({ label: subject, value: subject }));
});
const genderOptions = [
  { label: "女生", value: "female" },
  { label: "男生", value: "male" }
];
const filteredChildren = computed(() => {
  if (!selectedGroupId.value) return students.items;
  const group = students.groups.find((g) => g.id === selectedGroupId.value);
  if (!group) return students.items;
  return students.items.filter((s) => group.memberIds?.includes(s.id));
});
const treeItems = computed(() => {
  const items: Array<{ key: string; label: string; count: number; type: "all" | "class" | "subject" | "ungrouped"; group?: ChildGroup }> = [];
  items.push({ key: "all", label: `全部${cl.value}`, count: students.items.length, type: "all" });
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
      activeMistakeSubject.value = students.activeChild.mistakeBook.subjects[0] ?? "";
      if (!modelSupportsVision.value) {
        mistakeInputMode.value = "text";
      }
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

function resetForm(child?: Child) {
  editingStudentId.value = child?.id ?? null;
  form.name = child?.name ?? "";
  form.gender = child?.gender ?? "female";
  form.goal = child?.goal ?? "";
  form.style = child?.style ?? "";
  form.groupIds = child ? students.groups.filter((g) => g.memberIds.includes(child.id)).map((g) => g.id) : [];
  form.reportNotes = "";
}

function openCreateStudent() {
  resetForm();
  pageMode.value = "edit";
}

function openEditStudent(child: Child) {
  resetForm(child);
  pageMode.value = "edit";
}

function saveStudent() {
  if (!form.name.trim()) {
    message.warning(`请填写${cl.value}姓名`);
    return;
  }
  const draft = {
    name: form.name.trim(),
    gender: form.gender,
    goal: form.goal.trim() || "待设定目标",
    style: form.style.trim() || "待观察学习风格",
    materials: []
  };
  if (editingStudentId.value) {
    students.updateStudent(editingStudentId.value, draft);
    const studentId = editingStudentId.value;
    
    // Update group memberships
    const prevGroupIds = students.groups.filter((g) => g.memberIds.includes(studentId)).map((g) => g.id);
    for (const gid of prevGroupIds) {
      if (!form.groupIds.includes(gid)) students.removeStudentFromGroup(gid, studentId);
    }
    for (const gid of form.groupIds) {
      if (!prevGroupIds.includes(gid)) students.addStudentToGroup(gid, studentId);
    }
    message.success(`${cl.value}信息已更新`);
  } else {
    students.createStudent(draft);
    const newStudentId = students.activeChildId;
    for (const gid of form.groupIds) {
      students.addStudentToGroup(gid, newStudentId);
    }
    message.success(`${cl.value}已新增`);
  }
  pageMode.value = "list";
}

function childAvatar(child: Child) {
  return childAvatarSourceFor(students.appSettings.themeKey, child.gender);
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
  const undone = students.undoChildCourseCheckIn(studentId, subject);
  message[undone ? "success" : "warning"](undone ? `${subject} 已撤回 1 节课打卡` : `${subject} 暂无可撤回课时或不存在`);
}

function removeStudent(studentId: string) {
  const child = students.items.find((s) => s.id === studentId);
  if (!child) return;
  confirmDelete({
    content: `确定要删除${cl.value}「${child.name}」吗？该${cl.value}的所有课堂记录、提醒和课程也将一并删除。`,
    onOk: () => {
      const deleted = students.deleteStudent(studentId);
      if (deleted) {
        message.success(`${cl.value}已删除`);
      } else {
        message.warning(`至少保留一个${cl.value}档案`);
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
  activeMistakeSubject.value = students.activeChild.mistakeBook.subjects[0] ?? "";
  pageMode.value = "mistakeBook";
  message.info(`已打开${cl.value}错题本`);
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
      studentId: activeChild.value.id,
      subject: activeMistakeSubject.value || activeChild.value.mistakeBook.subjects[0],
      questionText,
      studentAnswer: "暂无作答",
      imagePath: imagePath || undefined
    }, (_delta, fullContent) => {
      streamingAnalysisText.value = fullContent;
    });

    // Save to structured database
    await students.createMistakeRecord({
      studentId: activeChild.value.id,
      subject: activeMistakeSubject.value || activeChild.value.mistakeBook.subjects[0],
      questionText: result.questionText || questionText,
      imagePath: imagePath || undefined,
      studentAnswer: "暂无作答",
      correctAnswer: result.correctAnswer,
      mistakeReason: result.mistakeReason,
      knowledgePoints: result.knowledgePoints,
      similarQuestions: result.similarQuestions
    });

    // Also update the legacy summary
    students.updateMistakeAnalysis(activeChild.value.id, {
      analysis: result.mistakeReason,
      knowledgeInsight: result.knowledgePoints.join("、"),
      aiPending: Math.max(activeChild.value.mistakeBook.aiPending - 1, 0)
    });
    message.success("AI 已生成错题分析并保存到错题本");
  } catch (error) {
    message.error(`AI 分析失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isAnalyzingMistake.value = false;
  }
}

async function runGenerateSimilarQuestions() {
  const questionText = mistakeQuestionText.value.trim();
  const imagePath = mistakeInputMode.value === "image" ? selectedMistakeImagePath.value : "";
  if (mistakeInputMode.value === "text" && !questionText) {
    message.warning("请先输入题目内容");
    return;
  }
  if (mistakeInputMode.value === "image" && !imagePath) {
    message.warning("请先上传错题图片");
    return;
  }
  isGeneratingSimilarQuestions.value = true;
  streamingSimilarQuestionsText.value = "";
  try {
    const questions = await generateSimilarQuestionsStream({
      studentId: activeChild.value.id,
      subject: activeMistakeSubject.value || activeChild.value.mistakeBook.subjects[0],
      questionText,
      studentAnswer: "暂无作答",
      imagePath: imagePath || undefined
    }, (_delta, fullContent) => {
      streamingSimilarQuestionsText.value = fullContent;
    });
    students.updateMistakeAnalysis(activeChild.value.id, {
      similarQuestions: questions.join("，"),
      aiPending: Math.max(activeChild.value.mistakeBook.aiPending - 1, 0)
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
  try {
    selectedMistakeImageDataUrl.value = await invoke<string>("read_mistake_image_data_url", { path: selected });
  } catch (err) {
    message.warning("图片预览加载失败，但仍可进行分析");
    selectedMistakeImageDataUrl.value = "";
  }
  await runAiAnalysis();
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

function switchMistakeInputMode(mode: "text" | "image") {
  if (mode === "image" && !modelSupportsVision.value) {
    message.warning("当前默认模型不支持图片识别，请在设置中切换支持识图的模型");
    return;
  }
  mistakeInputMode.value = mode;
  if (mode === "text") {
    selectedMistakeImagePath.value = "";
    selectedMistakeImageDataUrl.value = "";
  } else {
    mistakeQuestionText.value = "";
  }
  streamingAnalysisText.value = "";
  streamingSimilarQuestionsText.value = "";
}

function openMistakeDetail(record: MistakeRecord) {
  selectedMistakeRecord.value = record;
  showMistakeDetailModal.value = true;
}

function closeMistakeDetail() {
  showMistakeDetailModal.value = false;
  selectedMistakeRecord.value = null;
}

function handleCreateNewMistake() {
  // Switch to the input mode to create a new mistake
  mistakeInputMode.value = "text";
  mistakeQuestionText.value = "";
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

function openEditGroup(group: ChildGroup) {
  editingGroupId.value = group.id;
  groupForm.name = group.name;
  groupForm.description = group.description;
  groupForm.type = group.type;
  groupForm.color = group.color;
  groupForm.subjects = group.subjects ? [...group.subjects] : [];
  groupForm.memberIds = group.memberIds ? [...group.memberIds] : [];
  showGroupModal.value = true;
}

function saveGroup() {
  if (!groupForm.name.trim()) {
    message.warning("请填写分组名称");
    return;
  }
  if (editingGroupId.value) {
    const groupId = editingGroupId.value;
    const group = students.groups.find((g) => g.id === groupId);
    if (!group) return;
    const prevIds = [...(group.memberIds ?? [])];
    students.updateGroup(groupId, {
      name: groupForm.name.trim(),
      description: groupForm.description.trim(),
      type: groupForm.type,
      color: groupForm.color,
      subjects: groupForm.type === "subject" ? groupForm.subjects : []
    });
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
    content: `确定要删除分组「${group.name}」吗？该分组下的${cl.value}不会受影响。`,
    onOk: () => {
      students.deleteGroup(groupId);
      message.success("分组已删除");
    }
  });
}

function toggleStudentInGroup(groupId: string, studentId: string) {
  const group = students.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (group.memberIds?.includes(studentId)) {
    students.removeStudentFromGroup(groupId, studentId);
  } else {
    students.addStudentToGroup(groupId, studentId);
  }
}

// For group member management inside groupManage page
const groupMemberDraft = ref<Record<string, string[]>>({});

function initGroupMemberDraft(group: ChildGroup) {
  groupMemberDraft.value[group.id] = [...(group.memberIds ?? [])];
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

async function openMaterial(sourcePath: string) {
  if (!sourcePath.trim()) {
    message.warning("这份资料还没有路径");
    return;
  }
  if (!isTauri()) {
    message.info("Web 预览环境不能打开本机资料，请在 Tauri 桌面端使用");
    return;
  }
  try {
    await invoke("open_material_target", { path: sourcePath });
    message.success("已交给系统打开资料");
  } catch (error) {
    message.error(`打开资料失败：${String(error)}`);
  }
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">{{ cl }}管理</h1>
        <p class="page-subtitle">卡片化管理{{ cl }}、多学科课程、错题本和 AI 分析入口</p>
      </div>
      <n-space align="center">
        <n-button v-if="props.userRole !== 'parent'" secondary @click="openGroupManage">
          <template #icon>
            <Settings2 :size="16" />
          </template>
          管理分组
        </n-button>
        <n-button v-if="props.userRole !== 'parent'" type="primary" @click="openCreateStudent">
          <template #icon>
            <Plus :size="16" />
          </template>
          新增{{ cl }}
        </n-button>
      </n-space>
    </div>

    <section v-if="pageMode === 'list'" class="child-management-page">
      <aside class="group-sidebar">
        <div class="group-sidebar-header">
          <UsersRound :size="16" />
          <span>{{ cl }}列表</span>
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

      <section class="child-grid">
        <div v-if="filteredChildren.length === 0" class="list-empty-state">该分组暂无{{ cl }}</div>
        <article v-for="child in filteredChildren" :key="child.id" class="child-card">
          <header>
            <img class="child-card-avatar" :src="childAvatar(child)" :alt="`${child.name}头像`" />
            <div>
              <h2>{{ child.name }}</h2>
              <p>{{ child.gender === "male" ? "男生" : "女生" }} · 目标：{{ child.goal }} · 风格：{{ child.style }}</p>
            </div>
          </header>

          <div v-if="studentGroupsFor(child.id).length > 0" class="group-tags">
            <span
              v-for="sg in studentGroupsFor(child.id)"
              :key="sg.id"
              class="group-tag"
              :style="{ '--tag-color': sg.color }"
            >{{ sg.name }}</span>
          </div>

          <div class="course-list">
            <div v-for="course in getChildCourses(child.id)" :key="course.id" class="course-row">
              <n-space justify="space-between" align="center">
                <strong>{{ course.subject }} · 第 {{ course.currentLesson }}/{{ course.totalLessons }} 节 · {{ course.progress }}%</strong>
                <n-space v-if="props.userRole !== 'parent'" size="small">
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson >= course.totalLessons"
                    @click="checkInCourse(child.id, course.subject)"
                  >
                    打卡
                  </n-button>
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson <= 0"
                    @click="undoCourseCheckIn(child.id, course.subject)"
                  >
                    撤回
                  </n-button>
                </n-space>
              </n-space>
              <n-progress type="line" :percentage="course.progress" :show-indicator="false" :height="7" color="var(--primary)" />
            </div>
          </div>

          <div class="mistake-entry">
            <strong>{{ child.mistakeBook.summary }}</strong>
            <div class="mistake-focus-summary" aria-label="错题本概览">
              <span>覆盖 {{ child.mistakeBook.subjects.length }} 科</span>
              <span>AI 待处理 {{ child.mistakeBook.aiPending }} 题</span>
            </div>
            <p>重点薄弱点：{{ child.mistakeBook.weakPoints.slice(0, 3).join("、") }}</p>
            <n-button type="primary" strong @click="openMistakeBook(child.id)">
              <template #icon>
                <NotebookPen :size="16" />
              </template>
              进入错题本
            </n-button>
          </div>

          <n-space>
            <n-button size="small" secondary @click="openStudentDetail(child.id)">查看</n-button>
            <template v-if="props.userRole !== 'parent'">
              <n-button size="small" secondary @click="openEditStudent(child)">编辑</n-button>
              <n-button size="small" secondary type="error" @click="removeStudent(child.id)">删除</n-button>
            </template>
          </n-space>
        </article>
      </section>
    </section>

    <section v-else-if="pageMode === 'groupManage'" class="group-manage-page">
      <div class="child-page-toolbar">
        <n-button secondary @click="pageMode = 'list'; selectedGroupId = null">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回{{ cl }}列表
        </n-button>
        <n-space style="margin-left: auto;">
          <n-button size="small" type="primary" @click="openCreateGroup('class')">
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
          <div v-if="props.userRole !== 'parent'" class="group-manage-actions">
            <n-button size="tiny" secondary @click="openEditGroup(group)">编辑</n-button>
            <n-button size="tiny" secondary type="error" @click="deleteGroup(group.id)">删除</n-button>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="pageMode === 'mistakeBook'" class="mistake-book-fullpage">
      <MistakeBookPage
        :student-id="activeChild.id"
        :user-role="props.userRole"
        @back="pageMode = 'list'"
      />
    </section>

    <section v-else class="child-detail-page">
      <div class="child-page-toolbar">
        <n-button secondary @click="pageMode = 'list'; selectedGroupId = null">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回{{ cl }}列表
        </n-button>
      </div>

      <section class="side-panel child-detail-panel">
        <!-- 详情页（只读） -->
        <template v-if="pageMode === 'detail'">
          <div class="panel-heading">
            <UserRound :size="18" />
            <h2>{{ activeChild.name }} · {{ cl }}详情</h2>
          </div>
          <div v-if="studentGroupsFor(activeChild.id).length > 0" class="group-tags">
            <span
              v-for="sg in studentGroupsFor(activeChild.id)"
              :key="sg.id"
              class="group-tag"
              :style="{ '--tag-color': sg.color }"
            >{{ sg.name }}</span>
          </div>
          <div class="detail-list">
            <div>
              <span>学习目标</span>
              <strong>{{ activeChild.goal }}</strong>
            </div>
            <div>
              <span>学习风格</span>
              <strong>{{ activeChild.style }}</strong>
            </div>
            <div>
              <span>已分配资料</span>
              <div v-if="activeStudentMaterials.length > 0" class="assigned-materials">
                <n-button
                  v-for="mat in activeStudentMaterials"
                  :key="mat.id"
                  size="tiny"
                  type="primary"
                  @click="openMaterial(mat.sourcePath)"
                >
                  <template #icon><FileText :size="12" /></template>
                  {{ mat.title }}
                </n-button>
              </div>
              <span v-else class="muted-text">未分配</span>
            </div>
          </div>
          <div class="course-list">
            <div v-for="course in activeStudentCourses" :key="course.id" class="course-row">
              <n-space justify="space-between" align="center">
                <strong>{{ course.subject }} · 第 {{ course.currentLesson }}/{{ course.totalLessons }} 节 · {{ course.progress }}%</strong>
                <n-space size="small">
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson >= course.totalLessons"
                    @click="checkInCourse(activeChild.id, course.subject)"
                  >
                    打卡
                  </n-button>
                  <n-button
                    size="tiny"
                    secondary
                    :disabled="course.currentLesson <= 0"
                    @click="undoCourseCheckIn(activeChild.id, course.subject)"
                  >
                    撤回
                  </n-button>
                </n-space>
              </n-space>
              <n-progress type="line" :percentage="course.progress" :show-indicator="false" :height="7" color="var(--primary)" />
            </div>
          </div>
          <section class="child-follow-section">
            <div class="panel-heading compact">
              <CalendarCheck2 :size="17" />
              <h3>学习计划</h3>
            </div>
            <div v-if="activeStudentPlans.length === 0" class="detail-empty">暂无计划或提醒</div>
            <div v-for="plan in activeStudentPlans" :key="`${plan.type}-${plan.id}`" class="child-follow-item">
              <strong>{{ formatStudentPlanTime(plan.time) }} · {{ plan.title }}</strong>
              <span>{{ plan.type }} · {{ plan.detail }}</span>
            </div>
          </section>
          <section class="child-follow-section">
            <div class="panel-heading compact">
              <FileText :size="17" />
              <h3>学习报告</h3>
            </div>
            <div v-if="activeStudentReport" class="child-follow-item">
              <strong>平均进度 {{ activeStudentReport.averageProgress }}% · 作业 {{ activeStudentReport.homeworkCount }} 项</strong>
              <span>课堂记录 {{ activeStudentReport.classRecordCount }} 条 · 待批改 {{ activeStudentReport.pendingGradingCount }} 项</span>
              <span>下一步：{{ activeStudentReport.nextActions.join("；") }}</span>
            </div>
          </section>
          <section class="child-follow-section">
            <div class="panel-heading compact">
              <UsersRound :size="17" />
              <h3>所属分组</h3>
            </div>
            <div v-if="studentGroupsFor(activeChild.id).length === 0" class="detail-empty">未加入任何分组</div>
            <div v-for="g in studentGroupsFor(activeChild.id)" :key="g.id" class="child-follow-item">
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

        <!-- 编辑页 -->
        <template v-if="pageMode === 'edit'">
          <div class="panel-heading">
            <UserRound :size="18" />
            <h2>{{ editingStudentId ? `编辑${cl}` : `新增${cl}` }}</h2>
          </div>
          <n-form label-placement="top">
            <n-form-item :label="`${cl}姓名`">
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
          <n-space style="margin-top: 16px;">
            <n-button type="primary" @click="saveStudent">保存</n-button>
            <n-button secondary @click="pageMode = 'list'">取消</n-button>
          </n-space>
        </template>
      </section>
    </section>

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
            placeholder="选择{{ cl }}"
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

    <n-modal v-model:show="showImagePreview" preset="card" title="错题图片" class="image-preview-modal" :style="{ maxWidth: '90vw' }">
      <img :src="selectedMistakeImageDataUrl" alt="错题原图" style="width: 100%; height: auto; border-radius: var(--radius-md);" />
    </n-modal>

    <MobileConnectModal
      :show="showMobileConnectModal"
      @update:show="(v: boolean) => showMobileConnectModal = v"
      @new-image="handleMobileImage"
    />

  </div>
</template>

<style scoped>
.assigned-materials {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.material-assign-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.material-assign-label {
  flex-shrink: 0;
  color: var(--muted-strong);
  font-size: 13px;
}

.detail-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.material-assignment-list {
  display: grid;
  gap: 8px;
  width: 100%;
}

.material-assignment-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.material-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.material-meta {
  font-size: 11px;
  color: var(--muted);
}

.course-tree {
  display: grid;
  gap: 8px;
  width: 100%;
}

.course-tree-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
}

.course-tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.course-tree-header:hover {
  background: var(--bg-elevated);
}

.course-tree-header .n-icon {
  transition: transform 0.2s;
}

.course-tree-header .expanded {
  transform: rotate(90deg);
}

.course-subject {
  flex: 1;
  font-weight: 600;
  color: var(--text);
}

.course-progress {
  font-size: 12px;
  color: var(--muted);
}

.course-tree-content {
  padding: 0 12px 12px;
  border-top: 1px solid var(--border);
}

.course-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.course-lessons-list {
  margin-top: 12px;
}

.course-lessons-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-strong);
  margin-bottom: 8px;
}

.lesson-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.lesson-number {
  flex-shrink: 0;
  width: 50px;
  font-size: 12px;
  color: var(--muted);
}

.child-follow-item :deep(.n-button--primary) {
  --n-text-color: #fff !important;
  --n-color: var(--primary) !important;
}

.child-follow-item :deep(.n-button--secondary) {
  --n-text-color: var(--text) !important;
  --n-color: var(--panel-solid) !important;
}
</style>
