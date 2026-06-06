<script setup lang="ts">
import { useMessage } from "naive-ui";
import { computed, reactive, watch } from "vue";
import { useStudentStore } from "../students/studentStore";
import { buildLearningPlanSubjectOptions, learningPlanSubjectCountText } from "./learningPlanSubjects";

const workspace = useStudentStore();
const message = useMessage();
const form = reactive({
  studentId: workspace.activeStudentId,
  subject: workspace.activeStudent.courses[0]?.subject ?? "",
  currentLesson: workspace.activeStudent.courses[0]?.currentLesson ?? 1,
  totalLessons: workspace.activeStudent.courses[0]?.totalLessons ?? 10,
  remindAt: Date.now() + 24 * 60 * 60 * 1000
});

const studentOptions = computed(() => workspace.items.map((student) => ({ label: student.name, value: student.id })));
const selectedStudent = computed(() => workspace.items.find((student) => student.id === form.studentId) ?? workspace.activeStudent);
const courseOptions = computed(() => buildLearningPlanSubjectOptions(selectedStudent.value.courses));
const subjectCountText = computed(() => learningPlanSubjectCountText(courseOptions.value.map((option) => option.value)));
const progressPreview = computed(() => {
  const totalLessons = Math.max(Number(form.totalLessons) || 1, 1);
  const currentLesson = Math.min(Math.max(Number(form.currentLesson) || 0, 0), totalLessons);
  return Math.min(Math.round((currentLesson / totalLessons) * 100), 100);
});

function loadCourse(subject: string) {
  const course = selectedStudent.value.courses.find((item) => item.subject === subject);
  form.subject = subject;
  if (!course) return;
  form.currentLesson = course.currentLesson;
  form.totalLessons = course.totalLessons;
}

watch(
  () => form.studentId,
  () => {
    const firstCourse = selectedStudent.value.courses[0];
    if (firstCourse) {
      loadCourse(firstCourse.subject);
    }
  }
);

function saveCoursePlan() {
  if (!form.studentId || !form.subject) {
    message.warning("请选择学生和科目");
    return;
  }
  const subject = form.subject.trim();
  const course = {
    subject,
    currentLesson: Number(form.currentLesson) || 0,
    totalLessons: Number(form.totalLessons) || 1,
    progress: 0
  };
  const existingCourse = selectedStudent.value.courses.some((item) => item.subject === subject);
  const saved = existingCourse
    ? workspace.updateStudentCourse(form.studentId, subject, course)
    : workspace.createStudentCourse(form.studentId, course);
  message[saved ? "success" : "warning"](saved ? (existingCourse ? "学习计划已更新" : "课程已新增") : "课程保存失败");
}

function createCourseReminder() {
  if (!form.studentId || !form.subject || !form.remindAt) {
    message.warning("请选择学生、科目和提醒时间");
    return;
  }
  const created = workspace.createCourseReminder(form.studentId, form.subject.trim(), Number(form.remindAt));
  message[created ? "success" : "warning"](created ? "课程提醒已加入日历计划" : "未找到对应课程");
}

function deleteCoursePlan(studentId: string, subject: string) {
  const deleted = workspace.deleteStudentCourse(studentId, subject);
  message[deleted ? "success" : "warning"](deleted ? "课程已删除" : "至少保留一个课程");
  if (deleted && form.studentId === studentId) {
    const firstCourse = selectedStudent.value.courses[0];
    if (firstCourse) {
      loadCourse(firstCourse.subject);
    }
  }
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">学习计划</h1>
        <p class="page-subtitle">维护每个学生的课程大纲、课时进度和学习状态</p>
      </div>
      <n-button type="primary" @click="saveCoursePlan">保存计划</n-button>
    </div>

    <div class="dashboard-grid">
      <section class="side-panel wide-panel">
        <h2>学生课程计划</h2>
        <div v-for="student in workspace.items" :key="student.id" class="list-row">
          <strong>{{ student.name }} · {{ student.goal }}</strong>
          <div v-for="course in student.courses" :key="course.subject" class="course-row">
            <n-space justify="space-between" align="center">
              <p>{{ course.subject }} · 第 {{ course.currentLesson }}/{{ course.totalLessons }} 节 · {{ course.progress }}%</p>
              <n-button size="tiny" quaternary type="error" @click="deleteCoursePlan(student.id, course.subject)">删除</n-button>
            </n-space>
            <n-progress type="line" :percentage="course.progress" :show-indicator="false" :height="7" color="var(--primary)" />
          </div>
        </div>
      </section>

      <aside class="side-panel">
        <h2>编辑课程进度</h2>
        <n-form label-placement="top">
          <n-form-item label="学生">
            <n-select
              v-model:value="form.studentId"
              :options="studentOptions"
              @update:value="loadCourse(selectedStudent.courses[0]?.subject ?? '')"
            />
          </n-form-item>
          <n-form-item label="科目">
            <n-select
              v-model:value="form.subject"
              :options="courseOptions"
              filterable
              tag
              placeholder="选择或输入新科目"
              @update:value="loadCourse"
            />
            <div class="subject-compact-summary">
              <span>{{ subjectCountText }}</span>
              <strong>{{ form.subject || "请选择科目" }}</strong>
            </div>
          </n-form-item>
          <n-form-item label="当前节次">
            <n-input-number v-model:value="form.currentLesson" :min="0" />
          </n-form-item>
          <n-form-item label="总节次">
            <n-input-number v-model:value="form.totalLessons" :min="1" />
          </n-form-item>
          <n-form-item label="自动进度">
            <div class="auto-progress-preview">
              <strong>{{ progressPreview }}%</strong>
              <span>由当前节次 / 总节次自动计算</span>
            </div>
          </n-form-item>
          <n-form-item label="下次课提醒">
            <n-date-picker v-model:value="form.remindAt" type="datetime" clearable />
          </n-form-item>
        </n-form>
        <n-space>
          <n-button type="primary" @click="saveCoursePlan">保存计划</n-button>
          <n-button secondary @click="createCourseReminder">创建课程提醒</n-button>
        </n-space>
      </aside>
    </div>
  </div>
</template>
