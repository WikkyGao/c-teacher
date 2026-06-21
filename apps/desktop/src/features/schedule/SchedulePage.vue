<script setup lang="ts">
import { ArrowLeft, Plus } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { ScheduledLesson } from "../children/childStore";
import { useChildStore } from "../children/childStore";
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

const workspace = useChildStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const editingLessonId = ref<string | null>(null);
const calendarMode = ref<CalendarMode>("week");
const calendarAnchor = ref(Date.now());
const dayGridRef = ref<HTMLElement | null>(null);
const pageMode = ref<"calendar" | "form">("calendar");
const assignMode = ref<"child" | "group">("child");
const hoveredGroupKey = ref<string | null>(null);
const form = reactive({
  studentId: workspace.activeChildId,
  groupId: null as string | null,
  subject: workspace.activeChild.courses[0]?.subject ?? "数学",
  startsAt: nextHour(),
  durationMinutes: 90,
  topic: "",
  note: ""
});

type GroupedLessonItem = {
  kind: "group";
  key: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  students: Array<{ id: string; name: string }>;
  startsAt: number;
  durationMinutes: number;
  subject: string;
};

type IndividualLessonItem = {
  kind: "individual";
  key: string;
  lessonId: string;
  studentName: string;
  studentId: string;
  startsAt: number;
  durationMinutes: number;
  subject: string;
  topic: string;
};

type CalendarLessonItem = GroupedLessonItem | IndividualLessonItem;

const modeOptions = [
  { label: "月", value: "month" },
  { label: "周", value: "week" },
  { label: "日", value: "day" }
] satisfies Array<{ label: string; value: CalendarMode }>;
const durationOptions = [45, 60, 90, 120, 150].map((value) => ({ label: `${value} 分钟`, value }));
const childOptions = computed(() => workspace.items.map((child) => ({ label: child.name, value: child.id })));
const groupOptions = computed(() =>
  workspace.groups.map((g) => ({ label: `${g.name}（${g.type === "class" ? "班级" : "小组"}）`, value: g.id }))
);
const selectedChild = computed(() => workspace.items.find((child) => child.id === form.studentId) ?? workspace.activeChild);
const subjectOptions = computed(() => {
  return selectedChild.value.courses.map((course) => ({ label: course.subject, value: course.subject }));
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
      key: `child:${lesson.id}`,
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

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function lessonStyle(item: CalendarLessonItem) {
  const date = new Date(item.startsAt);
  const startHour = date.getHours() + date.getMinutes() / 60;
  const top = Math.max(startHour * hourHeight, 4);
  const height = Math.max((item.durationMinutes / 60) * hourHeight, 40);
  return {
    "--lesson-top": `${top}px`,
    "--lesson-height": `${height}px`
  };
}

function lessonBorderStyle(item: CalendarLessonItem) {
  const color = lessonGroupColor(item);
  return color ? { "--lesson-accent": color } : {};
}

function scrollDayViewToMorning() {
  if (calendarMode.value !== "day") return;
  void nextTick(() => {
    if (!dayGridRef.value) return;
    dayGridRef.value.scrollTop = 7 * hourHeight;
  });
}

function itemsForDay(dayStart: number, dayEnd: number) {
  return calendarItems.value.filter((item) => item.startsAt >= dayStart && item.startsAt < dayEnd);
}

function shiftCalendar(direction: -1 | 1) {
  calendarAnchor.value = shiftCalendarAnchor(calendarMode.value, calendarAnchor.value, direction);
}

function returnToToday() {
  calendarAnchor.value = Date.now();
  scrollDayViewToMorning();
}

function openCreateForm(startsAt?: number) {
  resetForm();
  if (startsAt) form.startsAt = startsAt;
  pageMode.value = "form";
}

function resetForm() {
  editingLessonId.value = null;
  assignMode.value = "child";
  form.studentId = workspace.activeChildId;
  form.groupId = null;
  form.subject = workspace.activeChild.courses[0]?.subject ?? "";
  form.startsAt = nextHour();
  form.durationMinutes = 90;
  form.topic = "";
  form.note = "";
}

function openEditForm(item: CalendarLessonItem) {
  if (item.kind === "group") return;
  editingLessonId.value = item.lessonId;
  assignMode.value = "child";
  form.studentId = item.studentId;
  form.groupId = null;
  form.subject = item.subject;
  form.startsAt = item.startsAt;
  form.durationMinutes = item.durationMinutes;
  form.topic = item.topic;
  form.note = "";
  pageMode.value = "form";
}

function onGroupSelected(groupId: string) {
  const group = workspace.groups.find((g) => g.id === groupId);
  if (group?.type === "subject" && group.subjects && group.subjects.length > 0) {
    form.subject = group.subjects[0];
  }
}

function saveLesson() {
  if (!form.subject.trim() || !form.startsAt) {
    message.warning("请填写科目和开始时间");
    return;
  }
  if (assignMode.value === "child") {
    if (!form.studentId) {
      message.warning("请选择小孩");
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
    } else {
      workspace.createScheduledLesson(draft);
    }
  } else {
    if (!form.groupId) {
      message.warning("请选择班级或小组");
      return;
    }
    const group = workspace.groups.find((g) => g.id === form.groupId);
    if (!group || group.memberIds.length === 0) {
      message.warning("该分组下没有小孩");
      return;
    }
    for (const studentId of group.memberIds) {
      workspace.createScheduledLesson({
        studentId,
        subject: form.subject.trim(),
        startsAt: Number(form.startsAt),
        durationMinutes: Number(form.durationMinutes) || 60,
        topic: form.topic.trim(),
        note: form.note.trim()
      });
    }
  }
  message.success(editingLessonId.value ? "课程已更新" : "课程已创建");
  pageMode.value = "calendar";
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
    <template v-if="pageMode === 'calendar'">
      <div class="page-top">
        <div>
          <h1 class="page-title">课程表</h1>
          <p class="page-subtitle">按日、周、月查看班级/小组课程安排，鼠标悬停查看对应小孩。</p>
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
          <n-button type="primary" @click="openCreateForm()">
            <template #icon>
              <Plus :size="16" />
            </template>
            新建课程
          </n-button>
        </n-space>
      </div>

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
              @click="openCreateForm(cell.start + 18 * 60 * 60 * 1000)"
            >
              <span>{{ cell.dayNumber }}</span>
              <div
                v-for="item in itemsForDay(cell.start, cell.end)"
                :key="item.key"
                class="schedule-month-lesson"
                :class="{ 'schedule-month-lesson-group': item.kind === 'group' }"
                :style="lessonBorderStyle(item)"
                @click.stop="openEditForm(item)"
                @mouseenter="hoveredGroupKey = item.kind === 'group' ? item.key : null"
                @mouseleave="hoveredGroupKey = null"
              >
                <template v-if="item.kind === 'group'">
                  <strong :style="{ color: item.groupColor }">{{ item.groupName }}</strong>
                  <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                  <div v-if="hoveredGroupKey === item.key" class="schedule-group-hover-list">
                    <div v-for="s in item.students" :key="s.id">{{ s.name }}</div>
                  </div>
                  <span class="schedule-lesson-class-dot" :style="{ background: item.groupColor }" />
                </template>
                <template v-else>
                  <strong>{{ formatTime(item.startsAt) }} {{ item.studentName }}</strong>
                  <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                  <span v-if="lessonGroupColor(item)" class="schedule-lesson-class-dot" :style="{ background: lessonGroupColor(item) }" />
                </template>
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
              <div v-if="itemsForDay(day.start, day.end).length === 0" class="schedule-week-empty">暂无课程</div>
              <button
                v-for="item in itemsForDay(day.start, day.end)"
                :key="item.key"
                class="schedule-week-lesson"
                :class="{ 'schedule-week-lesson-group': item.kind === 'group' }"
                :style="lessonBorderStyle(item)"
                @click="openEditForm(item)"
                @mouseenter="hoveredGroupKey = item.kind === 'group' ? item.key : null"
                @mouseleave="hoveredGroupKey = null"
              >
                <template v-if="item.kind === 'group'">
                  <strong :style="{ color: item.groupColor }">{{ item.groupName }} · {{ item.subject }}</strong>
                  <span>{{ item.durationMinutes }} 分钟 · {{ item.students.length }} 人</span>
                  <div v-if="hoveredGroupKey === item.key" class="schedule-group-hover-list">
                    <div v-for="s in item.students" :key="s.id">{{ s.name }}</div>
                  </div>
                  <span class="schedule-lesson-class-dot" :style="{ background: item.groupColor }" />
                </template>
                <template v-else>
                  <strong>{{ formatTime(item.startsAt) }} · {{ item.studentName }} · {{ item.subject }}</strong>
                  <span>{{ item.durationMinutes }} 分钟 · {{ item.topic || "未填写课程内容" }}</span>
                  <span v-if="lessonGroupColor(item)" class="schedule-lesson-class-dot" :style="{ background: lessonGroupColor(item) }" />
                </template>
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
              <button v-for="hour in hours" :key="hour" type="button" class="schedule-time" @click="openCreateForm(dayHours[hour])">
                {{ hour }}:00
              </button>
            </div>
            <div class="schedule-day-column">
              <button
                v-for="item in itemsForDay(dayView.start, dayView.end)"
                :key="item.key"
                class="schedule-lesson"
                :class="{ 'schedule-lesson-group': item.kind === 'group' }"
                :style="{ ...lessonStyle(item), ...lessonBorderStyle(item) }"
                @click="openEditForm(item)"
                @mouseenter="hoveredGroupKey = item.kind === 'group' ? item.key : null"
                @mouseleave="hoveredGroupKey = null"
              >
                <template v-if="item.kind === 'group'">
                  <strong :style="{ color: item.groupColor }">{{ item.groupName }} · {{ item.subject }}</strong>
                  <span>{{ formatTime(item.startsAt) }}-{{ formatTime(item.startsAt + item.durationMinutes * 60 * 1000) }} · {{ item.durationMinutes }} 分钟 · {{ item.students.length }} 人</span>
                  <div v-if="hoveredGroupKey === item.key" class="schedule-group-hover-list">
                    <div v-for="s in item.students" :key="s.id">{{ s.name }}</div>
                  </div>
                </template>
                <template v-else>
                  <strong>{{ item.studentName }} · {{ item.subject }}</strong>
                  <span>{{ formatTime(item.startsAt) }}-{{ formatTime(item.startsAt + item.durationMinutes * 60 * 1000) }} · {{ item.durationMinutes }} 分钟</span>
                  <em>{{ item.topic || "未填写课程内容" }}</em>
                </template>
              </button>
            </div>
          </div>
        </template>
      </section>
    </template>

    <template v-else>
      <div class="page-top">
        <div>
          <h1 class="page-title">{{ editingLessonId ? "编辑课程" : "新建课程" }}</h1>
          <p class="page-subtitle">{{ editingLessonId ? "修改选定的课程信息" : "为小孩创建新的课程安排" }}</p>
        </div>
        <n-button secondary @click="goBack">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回课程表
        </n-button>
      </div>

      <section class="side-panel schedule-form-page">
        <n-form label-placement="top" :show-feedback="false">
          <n-form-item label="课程归属">
            <n-radio-group v-model:value="assignMode" :disabled="!!editingLessonId">
              <n-radio value="child">单个小孩</n-radio>
              <n-radio value="group">班级/科目分组</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="assignMode === 'child'" label="小孩">
            <n-select v-model:value="form.studentId" :options="childOptions" />
          </n-form-item>
          <n-form-item v-else label="班级/分组">
            <n-select v-model:value="form.groupId" :options="groupOptions" placeholder="选择班级或分组" @update:value="onGroupSelected" />
          </n-form-item>
          <n-form-item v-if="assignMode === 'child'" label="科目">
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
          <p v-if="assignMode === 'group'" class="muted-text">选择科目分组后，科目自动使用分组关联科目，课程将自动为该分组内的所有小孩创建。</p>
        </n-form>
        <n-space>
          <n-button type="primary" @click="saveLesson">{{ editingLessonId ? "保存课程" : "创建课程" }}</n-button>
          <n-button secondary @click="goBack">取消</n-button>
          <n-button v-if="editingLessonId" secondary type="error" @click="removeLesson">删除</n-button>
        </n-space>
      </section>
    </template>
  </div>
</template>
