<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { ScheduledLesson } from "../students/studentStore";
import { useStudentStore } from "../students/studentStore";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import {
  addDays,
  buildMonthCells,
  calendarTitle,
  type CalendarMode,
  shiftCalendarAnchor,
  startOfDay,
  startOfWeek,
  visibleRangeForMode
} from "./scheduleCalendar";

const workspace = useStudentStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const editingLessonId = ref<string | null>(null);
const calendarMode = ref<CalendarMode>("week");
const calendarAnchor = ref(Date.now());
const dayGridRef = ref<HTMLElement | null>(null);
const form = reactive({
  studentId: workspace.activeStudentId,
  subject: workspace.activeStudent.courses[0]?.subject ?? "数学",
  startsAt: nextHour(),
  durationMinutes: 90,
  topic: "",
  note: ""
});

const modeOptions = [
  { label: "月", value: "month" },
  { label: "周", value: "week" },
  { label: "日", value: "day" }
] satisfies Array<{ label: string; value: CalendarMode }>;
const durationOptions = [45, 60, 90, 120, 150].map((value) => ({ label: `${value} 分钟`, value }));
const studentOptions = computed(() => workspace.items.map((student) => ({ label: student.name, value: student.id })));
const selectedStudent = computed(() => workspace.items.find((student) => student.id === form.studentId) ?? workspace.activeStudent);
const subjectOptions = computed(() => {
  return selectedStudent.value.courses.map((course) => ({ label: course.subject, value: course.subject }));
});
const selectedGroupHasSubjects = computed(() => {
  if (!form.groupId) return false;
  const group = workspace.groups.find((g) => g.id === form.groupId);
  return group?.type === "subject" && (group.subjects?.length ?? 0) > 0;
});
const weekDays = computed(() => {
  const weekStart = startOfWeek(calendarAnchor.value);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date),
      dateLabel: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date),
      start: startOfDay(date.getTime()),
      end: startOfDay(date.getTime()) + 24 * 60 * 60 * 1000
    };
  });
});
const dayView = computed(() => {
  const start = startOfDay(calendarAnchor.value);
  const date = new Date(start);
  return {
    key: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date),
    dateLabel: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date),
    start,
    end: addDays(start, 1)
  };
});
const monthCells = computed(() => buildMonthCells(calendarAnchor.value));
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const hourHeight = 44;
const visibleLessons = computed(() => {
  const range = visibleRangeForMode(calendarMode.value, calendarAnchor.value);
  return workspace.scheduledLessonCalendarItems.filter((lesson) => lesson.startsAt >= range.start && lesson.startsAt < range.end);
});
const titleText = computed(() => calendarTitle(calendarMode.value, calendarAnchor.value));
const dayHours = computed(() => hours.map((hour) => dayView.value.start + hour * 60 * 60 * 1000));

const calendarItems = computed<CalendarLessonItem[]>(() => {
  const grouped = new Map<string, { groupId: string; students: Set<string>; startsAt: number; durationMinutes: number; subject: string }>();
  const coveredLessons = new Set<string>();

  for (const lesson of visibleLessons.value) {
    const studentGroups = workspace.groups.filter((g) => {
      if (!g.memberIds.includes(lesson.studentId)) return false;
      // For subject groups, only group if the lesson's subject matches
      if (g.type === "subject" && g.subjects.length > 0) {
        return g.subjects.includes(lesson.subject);
      }
      return true;
    });
    if (studentGroups.length === 0) continue;
    for (const group of studentGroups) {
      const key = `${group.id}:${lesson.startsAt}:${lesson.subject}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          groupId: group.id,
          students: new Set(),
          startsAt: lesson.startsAt,
          durationMinutes: lesson.durationMinutes,
          subject: lesson.subject
        });
      }
      grouped.get(key)!.students.add(lesson.studentId);
      coveredLessons.add(lesson.id);
    }
  }

  const items: CalendarLessonItem[] = [];
  for (const [, entry] of grouped) {
    const group = workspace.groups.find((g) => g.id === entry.groupId);
    if (!group) continue;
    const students = [...entry.students].map((id) => ({
      id,
      name: workspace.items.find((s) => s.id === id)?.name ?? id
    }));
    items.push({
      kind: "group",
      key: `group:${group.id}:${entry.startsAt}:${entry.subject}`,
      groupId: group.id,
      groupName: group.name,
      groupColor: group.color,
      students,
      startsAt: entry.startsAt,
      durationMinutes: entry.durationMinutes,
      subject: entry.subject
    });
  }

  for (const lesson of visibleLessons.value) {
    if (coveredLessons.has(lesson.id)) continue;
    items.push({
      kind: "individual",
      key: `student:${lesson.id}`,
      lessonId: lesson.id,
      studentName: lesson.studentName,
      studentId: lesson.studentId,
      startsAt: lesson.startsAt,
      durationMinutes: lesson.durationMinutes,
      subject: lesson.subject,
      topic: lesson.topic
    });
  }

  return items.sort((a, b) => a.startsAt - b.startsAt);
});

function lessonGroupColor(item: CalendarLessonItem): string {
  if (item.kind === "group") return item.groupColor;
  const studentGroups = workspace.groups.filter(
    (g) => g.type === "class" && g.memberIds.includes(item.studentId)
  );
  // Fall back to subject group color if no class
  if (!studentGroups[0]) {
    const subjectGroup = workspace.groups.find(
      (g) => g.type === "subject" && g.memberIds.includes(item.studentId) && g.subjects.includes(item.subject)
    );
    return subjectGroup?.color ?? "";
  }
  return studentGroups[0]?.color ?? "";
}

function nextHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.getTime();
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function lessonStyle(lesson: ScheduledLesson) {
  const date = new Date(lesson.startsAt);
  const startHour = date.getHours() + date.getMinutes() / 60;
  const top = Math.max(startHour * hourHeight, 4);
  const height = Math.max((lesson.durationMinutes / 60) * hourHeight, 40);
  return {
    "--lesson-top": `${top}px`,
    "--lesson-height": `${height}px`
  };
}

function scrollDayViewToMorning() {
  if (calendarMode.value !== "day") return;
  void nextTick(() => {
    if (!dayGridRef.value) return;
    dayGridRef.value.scrollTop = 7 * hourHeight;
  });
}

function lessonsForDay(dayStart: number, dayEnd: number) {
  return visibleLessons.value.filter((lesson) => lesson.startsAt >= dayStart && lesson.startsAt < dayEnd);
}

function shiftCalendar(direction: -1 | 1) {
  calendarAnchor.value = shiftCalendarAnchor(calendarMode.value, calendarAnchor.value, direction);
}

function returnToToday() {
  calendarAnchor.value = Date.now();
  scrollDayViewToMorning();
}

function createLessonAt(startsAt: number) {
  resetForm();
  form.startsAt = startsAt;
}

function resetForm() {
  editingLessonId.value = null;
  form.studentId = workspace.activeStudentId;
  form.subject = workspace.activeStudent.courses[0]?.subject ?? "";
  form.startsAt = nextHour();
  form.durationMinutes = 90;
  form.topic = "";
  form.note = "";
}

function editLesson(lesson: ScheduledLesson) {
  editingLessonId.value = lesson.id;
  form.studentId = lesson.studentId;
  form.subject = lesson.subject;
  form.startsAt = lesson.startsAt;
  form.durationMinutes = lesson.durationMinutes;
  form.topic = lesson.topic;
  form.note = lesson.note;
}

function onGroupSelected(groupId: string) {
  const group = workspace.groups.find((g) => g.id === groupId);
  if (group?.type === "subject" && group.subjects && group.subjects.length > 0) {
    form.subject = group.subjects[0];
  }
}

function saveLesson() {
  if (!form.studentId || !form.subject.trim() || !form.startsAt) {
    message.warning("请选择学生、科目和开始时间");
    return;
  }
  const draft = {
    studentId: form.studentId,
    subject: form.subject.trim(),
    startsAt: Number(form.startsAt),
    durationMinutes: Number(form.durationMinutes) || 60,
    topic: form.topic.trim(),
    note: form.note.trim()
  };
  if (editingLessonId.value) {
    workspace.updateScheduledLesson(editingLessonId.value, draft);
    message.success("课程已更新");
  } else {
    workspace.createScheduledLesson(draft);
    message.success("课程已创建");
  }
  resetForm();
}

function removeLesson() {
  const lessonId = editingLessonId.value;
  if (!lessonId) return;
  confirmDelete({
    content: "确定要删除这门课程吗？",
    onOk: () => {
      const deleted = workspace.deleteScheduledLesson(lessonId);
      message[deleted ? "success" : "warning"](deleted ? "课程已删除" : "未找到课程");
      pageMode.value = "calendar";
      resetForm();
    }
  });
}

function goBack() {
  pageMode.value = "calendar";
  resetForm();
}

watch(calendarMode, () => {
  scrollDayViewToMorning();
});
</script>

<template>
  <div class="schedule-page">
    <div class="page-top">
      <div>
        <h1 class="page-title">课程表</h1>
        <p class="page-subtitle">按日、周、月查看每天哪个学生有哪些科目的课、几点开始、每节课多长。</p>
      </div>
      <n-space align="center">
        <div class="calendar-view-switch">
          <span>视图</span>
          <div class="calendar-mode-buttons" role="group" aria-label="课程表视图切换">
            <button
              v-for="option in modeOptions"
              :key="option.value"
              type="button"
              class="calendar-mode-button"
              :class="{ active: calendarMode === option.value }"
              :aria-pressed="calendarMode === option.value"
              @click="calendarMode = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <n-button secondary circle aria-label="上一页" @click="shiftCalendar(-1)">‹</n-button>
        <n-button secondary @click="returnToToday">今天</n-button>
        <n-button secondary circle aria-label="下一页" @click="shiftCalendar(1)">›</n-button>
        <n-tag round>{{ titleText }}</n-tag>
        <n-button type="primary" @click="resetForm">
          <template #icon>
            <Plus :size="16" />
          </template>
          新建课程
        </n-button>
      </n-space>
    </div>

    <div class="schedule-layout">
      <section class="schedule-calendar" :class="`schedule-calendar-${calendarMode}`">
        <template v-if="calendarMode === 'month'">
          <div class="schedule-month-head">
            <div v-for="label in ['周一', '周二', '周三', '周四', '周五', '周六', '周日']" :key="label">{{ label }}</div>
          </div>
          <div class="schedule-month-grid">
            <button
              v-for="cell in monthCells"
              :key="cell.key"
              class="schedule-month-cell"
              :class="{ muted: !cell.inCurrentMonth, today: cell.isToday }"
              @click="createLessonAt(cell.start + 18 * 60 * 60 * 1000)"
            >
              <span>{{ cell.dayNumber }}</span>
              <div
                v-for="lesson in lessonsForDay(cell.start, cell.end)"
                :key="lesson.id"
                class="schedule-month-lesson"
                @click.stop="editLesson(lesson)"
              >
                <strong>{{ formatTime(lesson.startsAt) }} {{ lesson.studentName }}</strong>
                <em>{{ lesson.subject }} · {{ lesson.durationMinutes }} 分钟</em>
              </div>
            </button>
          </div>
        </template>

        <template v-else-if="calendarMode === 'week'">
          <div class="schedule-week-list">
            <section v-for="day in weekDays" :key="day.key" class="schedule-week-day">
              <header>
                <strong>{{ day.label }}</strong>
                <span>{{ day.dateLabel }}</span>
              </header>
              <div v-if="lessonsForDay(day.start, day.end).length === 0" class="schedule-week-empty">暂无课程</div>
              <button
                v-for="lesson in lessonsForDay(day.start, day.end)"
                :key="lesson.id"
                class="schedule-week-lesson"
                @click="editLesson(lesson)"
              >
                <strong>{{ formatTime(lesson.startsAt) }} · {{ lesson.studentName }} · {{ lesson.subject }}</strong>
                <span>{{ lesson.durationMinutes }} 分钟 · {{ lesson.topic || "未填写课程内容" }}</span>
              </button>
            </section>
          </div>
        </template>

        <template v-else>
          <div class="schedule-head schedule-head-day">
            <div></div>
            <div>
              {{ dayView.label }}
              <small>{{ dayView.dateLabel }}</small>
            </div>
          </div>
          <div ref="dayGridRef" class="schedule-grid schedule-grid-day">
            <div class="schedule-time-column">
              <button v-for="hour in hours" :key="hour" type="button" class="schedule-time" @click="createLessonAt(dayHours[hour])">
                {{ hour }}:00
              </button>
            </div>
            <div class="schedule-day-column">
              <button
                v-for="lesson in lessonsForDay(dayView.start, dayView.end)"
                :key="lesson.id"
                class="schedule-lesson"
                :style="lessonStyle(lesson)"
                @click="editLesson(lesson)"
              >
                <strong>{{ lesson.studentName }} · {{ lesson.subject }}</strong>
                <span>{{ formatTime(lesson.startsAt) }}-{{ formatTime(lesson.endsAt) }} · {{ lesson.durationMinutes }} 分钟</span>
                <em>{{ lesson.topic || "未填写课程内容" }}</em>
              </button>
            </div>
          </div>
        </template>
      </section>

      <aside class="side-panel schedule-form-panel">
        <h2>{{ editingLessonId ? "编辑课程" : "新建课程" }}</h2>
        <n-form label-placement="top" :show-feedback="false">
          <n-form-item label="课程归属">
            <n-radio-group v-model:value="assignMode" :disabled="!!editingLessonId">
              <n-radio value="student">单个学生</n-radio>
              <n-radio value="group">班级/科目分组</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="assignMode === 'student'" label="学生">
            <n-select v-model:value="form.studentId" :options="studentOptions" />
          </n-form-item>
          <n-form-item v-else label="班级/分组">
            <n-select v-model:value="form.groupId" :options="groupOptions" placeholder="选择班级或分组" @update:value="onGroupSelected" />
          </n-form-item>
          <n-form-item v-if="assignMode === 'student'" label="科目">
            <n-select v-model:value="form.subject" :options="subjectOptions" filterable tag />
          </n-form-item>
          <n-form-item v-else-if="!selectedGroupHasSubjects" label="科目">
            <n-select v-model:value="form.subject" :options="subjectOptions" filterable tag />
          </n-form-item>
          <n-form-item label="开始时间">
            <n-date-picker v-model:value="form.startsAt" type="datetime" clearable />
          </n-form-item>
          <n-form-item label="时长">
            <n-select v-model:value="form.durationMinutes" :options="durationOptions" />
          </n-form-item>
          <n-form-item label="课程内容">
            <n-input v-model:value="form.topic" type="textarea" placeholder="例如：函数图像与性质" :autosize="{ minRows: 1, maxRows: 2 }" />
          </n-form-item>
          <n-form-item label="备注">
            <n-input v-model:value="form.note" type="textarea" placeholder="资料、作业或课前提醒" :autosize="{ minRows: 1, maxRows: 2 }" />
          </n-form-item>
          <p v-if="assignMode === 'group'" class="muted-text">选择科目分组后，科目自动使用分组关联科目，课程将自动为该分组内的所有学生创建。</p>
        </n-form>
        <n-space>
          <n-button type="primary" @click="saveLesson">{{ editingLessonId ? "保存课程" : "创建课程" }}</n-button>
          <n-button secondary @click="resetForm">取消</n-button>
          <n-button v-if="editingLessonId" secondary type="error" @click="removeLesson">删除</n-button>
        </n-space>

        <div class="schedule-today">
          <h2>今日课程</h2>
          <div v-if="todayLessons.length === 0" class="muted-text">今天暂未安排课程</div>
          <button v-for="lesson in todayLessons" :key="lesson.id" class="list-row compact-row" @click="editLesson(lesson)">
            <strong>{{ formatDateTime(lesson.startsAt) }} · {{ lesson.studentName }} · {{ lesson.subject }}</strong>
            <p>{{ lesson.topic || "未填写课程内容" }} · {{ lesson.durationMinutes }} 分钟</p>
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
