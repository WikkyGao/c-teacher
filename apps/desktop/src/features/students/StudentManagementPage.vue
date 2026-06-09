<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowLeft, CalendarCheck2, FileImage, FileText, NotebookPen, Plus, Sparkles, UserRound } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useMessage } from "naive-ui";
import { computed, reactive, ref, watch } from "vue";
import { analyzeMistake } from "../mistake-book/mistakeApi";
import { studentAvatarSourceFor } from "../../shared/assets/studentAvatars";
import { buildMistakeBookSubjectOptions, mistakeBookSubjectCountText } from "./mistakeBookPanel";
import type { Course, Student } from "./studentStore";
import { K12_MISTAKE_BOOK_SUBJECTS, useStudentStore } from "./studentStore";

const students = useStudentStore();
const props = defineProps<{
  initialMode?: "list" | "detail" | "mistakeBook";
}>();
const { activeStudent } = storeToRefs(students);
const message = useMessage();
const showStudentModal = ref(false);
const editingStudentId = ref<string | null>(null);
const selectedMistakeImagePath = ref("");
const pageMode = ref<"list" | "detail" | "mistakeBook">("list");
const activeMistakeSubject = ref("");
const form = reactive({
  name: "",
  gender: "female" as Student["gender"],
  goal: "",
  style: "",
  courses: [] as Course[],
  materialsText: ""
});
const modalTitle = computed(() => (editingStudentId.value ? "编辑学生" : "新增学生"));
const mistakeSubjectOptions = computed(() => buildMistakeBookSubjectOptions(activeStudent.value.mistakeBook.subjects));
const activeMistakeSubjectLabel = computed(() => activeMistakeSubject.value || activeStudent.value.mistakeBook.subjects[0]);
const mistakeSubjectCount = computed(() => mistakeBookSubjectCountText(activeStudent.value.mistakeBook.subjects));
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
    message.success("学生信息已更新");
  } else {
    students.createStudent(draft);
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
  const deleted = students.deleteStudent(studentId);
  if (deleted) {
    message.success("学生已删除");
  } else {
    message.warning("至少保留一个学生档案");
  }
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
  try {
    const result = await analyzeMistake({
      studentId: activeStudent.value.id,
      subject: activeStudent.value.mistakeBook.subjects[0],
      questionText: selectedMistakeImagePath.value ? "" : activeStudent.value.mistakeBook.summary,
      studentAnswer: "学生答案待补充",
      imagePath: selectedMistakeImagePath.value || undefined
    });
    students.updateMistakeAnalysis(activeStudent.value.id, {
      analysis: result.mistakeReason,
      similarQuestions: result.similarQuestions.join("，"),
      knowledgeInsight: result.knowledgePoints.join("、"),
      aiPending: Math.max(activeStudent.value.mistakeBook.aiPending - 1, 0)
    });
    message.success("AI 已生成待教师确认的错题分析");
  } catch {
    message.error("AI 服务暂不可用，已保留当前错题本内容");
  }
}

async function chooseMistakeImageAndAnalyze() {
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
            <n-button type="primary" strong secondary @click="openMistakeBook(student.id)">
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
          <n-button type="primary" secondary @click="pageMode = 'mistakeBook'">
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

          <div class="ai-note">
            <p><Sparkles :size="15" /> {{ activeMistakeSubjectLabel }}错误分析：{{ activeStudent.mistakeBook.analysis }}</p>
            <p><FileText :size="15" /> 类似题型：{{ activeStudent.mistakeBook.similarQuestions }}</p>
            <p>知识点分析：{{ activeStudent.mistakeBook.knowledgeInsight }}</p>
          </div>

          <n-space>
            <n-button type="primary" @click="chooseMistakeImageAndAnalyze">
              <template #icon>
                <FileImage :size="16" />
              </template>
              上传图片改题
            </n-button>
            <n-button secondary @click="runAiAnalysis">AI 分析</n-button>
            <n-button secondary @click="runAiAnalysis">出类似题</n-button>
          </n-space>
          <p v-if="selectedMistakeImagePath" class="muted-text">已选择错题图片：{{ selectedMistakeImagePath }}</p>
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
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showStudentModal = false">取消</n-button>
          <n-button type="primary" @click="saveStudent">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
