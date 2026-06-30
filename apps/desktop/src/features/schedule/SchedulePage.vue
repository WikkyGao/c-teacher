<script setup lang="ts">
import { ArrowLeft, Plus } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import type { ScheduledLesson } from "../children/childStore";
import { useChildStore, K12_MISTAKE_BOOK_SUBJECTS } from "../children/childStore";
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

const props = defineProps({ userRole: String });

const workspace = useChildStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const editingCourseId = ref<string | null>(null);
const calendarMode = ref<CalendarMode>("week");
const calendarAnchor = ref(Date.now());
const dayGridRef = ref<HTMLElement | null>(null);
const pageMode = ref<"calendar" | "list" | "courseForm">("calendar");
const viewMode = ref<"calendar" | "list">("calendar");
const assignMode = ref<"child" | "group">("child");
const hoveredGroupKey = ref<string | null>(null);
const expandedListItems = ref<Set<string>>(new Set());
const specificDates = ref<number[]>([]);
const showDatePicker = ref(false);

const courseForm = reactive({
  name: "",
  subject: "数学",
  scope: "personal" as "personal" | "class",
  groupId: null as string | null,
  studentId: null as string | null,
  totalLessons: 12,
  scheduleMode: "weekly" as "specific" | "weekly" | "biweekly",
  schedule: {
    dates: [] as string[],
    startDate: new Date().toISOString().split('T')[0],
    startTime: "14:00",
    duration: 90,
    weekday: 1
  },
  lessons: [] as Array<{ id: string; title: string; materialIds: string[]; order: number; date: string; startTime: string; duration: number }>
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
const weekdayOptions = [
  { label: "周日", value: 0 },
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 }
];
const scheduleModeOptions = [
  { label: "指定日期", value: "specific" },
  { label: "每周重复", value: "weekly" },
  { label: "每两周重复", value: "biweekly" }
];
const intervalOptions = [3, 5, 7, 10, 14, 21, 30].map((d) => ({ label: `每 ${d} 天`, value: d }));
const childOptions = computed(() => workspace.items.map((child) => ({ label: child.name, value: child.id })));
const groupOptions = computed(() =>
  workspace.groups.map((g) => ({ label: `${g.name}（${g.type === "class" ? "班级" : "小组"}）`, value: g.id }))
);
const materialOptions = computed(() => workspace.materials.map((m) => ({ label: m.title, value: m.id })));
const subjectOptions = computed(() => {
  return K12_MISTAKE_BOOK_SUBJECTS.map((s) => ({ label: s, value: s }));
});

// --- 列表视图数据（课程列表） ---
const listFilterSubject = ref<string | null>(null);
const expandedCourseIds = ref<Set<string>>(new Set());

const listSubjectOptions = computed(() => {
  const subjects = new Set(workspace.courses.map((c) => c.subject));
  return [...subjects].sort().map((s) => ({ label: s, value: s }));
});

const filteredCourses = computed(() => {
  let result = workspace.courses;
  if (listFilterSubject.value) {
    result = result.filter((c) => c.subject === listFilterSubject.value);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
});

function toggleCourseExpand(courseId: string) {
  if (expandedCourseIds.value.has(courseId)) {
    expandedCourseIds.value.delete(courseId);
  } else {
    expandedCourseIds.value.add(courseId);
  }
}

function isCourseExpanded(courseId: string) {
  return expandedCourseIds.value.has(courseId);
}

function getCourseLessons(courseId: string) {
  const course = workspace.courses.find((c) => c.id === courseId);
  const isClassScope = course && course.scope !== "personal";
  return workspace.scheduledLessons
    .filter((l) => {
      if (l.courseId !== courseId) return false;
      if (isClassScope) return l.studentId.startsWith("class:");
      return !l.studentId.startsWith("class:");
    })
    .sort((a, b) => a.startsAt - b.startsAt);
}

function getCourseStudents(courseId: string) {
  return workspace.getCourseStudents(courseId);
}

function formatListDate(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(timestamp));
}

function formatListTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function getScheduleModeLabel(mode: string): string {
  const map: Record<string, string> = { specific: "指定日期", weekly: "每周", biweekly: "每两周", interval: "自定义间隔" };
  return map[mode] ?? mode;
}

function getWeekdayLabel(weekday?: number): string {
  if (weekday === undefined) return "";
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return labels[weekday] ?? "";
}

// --- 日历视图数据 ---


function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

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
    if (coveredLessons.has(lesson.id)) continue;
    
    const studentGroups = workspace.groups.filter((g) => {
      if (lesson.studentId.startsWith("class:")) {
        const courseId = lesson.studentId.slice(6);
        const course = workspace.courses.find((c) => c.id === courseId);
        return course?.groupId === g.id;
      }
      if (!g.memberIds.includes(lesson.studentId)) return false;
      if (g.type === "subject" && g.subjects.length > 0) {
        return g.subjects.includes(lesson.subject);
      }
      return g.type === "class";
    });
    
    if (studentGroups.length === 0) continue;
    
    const group = studentGroups[0];
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
  if (!studentGroups[0]) {
    const subjectGroup = workspace.groups.find(
      (g) => g.type === "subject" && g.subjects.includes(item.subject)
    );
    return subjectGroup?.color ?? "";
  }
  return studentGroups[0].color;
}

function lessonBorderStyle(item: CalendarLessonItem) {
  const color = lessonGroupColor(item);
  return color ? { borderLeftColor: color } : {};
}

function itemsForDay(start: number, end: number) {
  return calendarItems.value.filter((item) => item.startsAt >= start && item.startsAt < end);
}

function itemsForHour(hourTimestamp: number) {
  const end = hourTimestamp + 60 * 60 * 1000;
  return calendarItems.value.filter((item) => item.startsAt >= hourTimestamp && item.startsAt < end);
}

function openCreateCourse(timestamp?: number) {
  editingCourseId.value = null;
  pageMode.value = "courseForm";
  courseForm.name = "";
  courseForm.subject = "数学";
  courseForm.scope = "personal";
  courseForm.groupId = null;
  courseForm.studentId = null;
  courseForm.totalLessons = 12;
  courseForm.scheduleMode = "weekly";
  if (timestamp) {
    const d = new Date(timestamp);
    const dateStr = d.toISOString().split('T')[0];
    courseForm.schedule.startDate = dateStr;
    courseForm.schedule.dates = [dateStr];
    specificDates.value = [d.getTime()];
    courseForm.schedule.startTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    courseForm.schedule.weekday = d.getDay();
  } else {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    courseForm.schedule.startDate = today;
    courseForm.schedule.dates = [today];
    specificDates.value = [now.getTime()];
    courseForm.schedule.startTime = "14:00";
    courseForm.schedule.weekday = 1;
  }
  courseForm.schedule.duration = 90;
  const baseDate = courseForm.schedule.dates[0] || courseForm.schedule.startDate;
  courseForm.lessons = Array.from({ length: 12 }, (_, i) => ({
    title: `第${i + 1}课`,
    materialIds: [],
    order: i,
    date: baseDate,
    startTime: courseForm.schedule.startTime,
    duration: courseForm.schedule.duration,
    id: `lesson-${Date.now()}-${i}`
  }));
}

function editCourse(courseId: string) {
  const course = workspace.courses.find((c) => c.id === courseId);
  if (!course) return;
  editingCourseId.value = courseId;
  pageMode.value = "courseForm";
  courseForm.name = course.name;
  courseForm.subject = course.subject;
  courseForm.scope = course.scope;
  courseForm.groupId = course.groupId ?? null;
  courseForm.studentId = course.studentIds[0] ?? null;
  courseForm.totalLessons = course.totalLessons;
  courseForm.scheduleMode = course.scheduleMode as "specific" | "weekly" | "biweekly";
  courseForm.schedule.startDate = course.schedule.startDate;
  courseForm.schedule.dates = course.scheduleMode === "specific" && course.schedule.dates
    ? [...course.schedule.dates]
    : [course.schedule.startDate];
  specificDates.value = courseForm.schedule.dates.map((d) => new Date(d).getTime());
  courseForm.schedule.startTime = course.schedule.startTime;
  courseForm.schedule.duration = course.schedule.duration;
  courseForm.schedule.weekday = course.schedule.weekday ?? new Date(course.schedule.startDate).getDay();
  courseForm.lessons = course.lessons.map((l, i) => ({
    id: l.id || `lesson-${Date.now()}-${i}`,
    title: l.title,
    materialIds: [...l.materialIds],
    order: l.order ?? i,
    date: l.date ?? course.schedule.startDate,
    startTime: l.startTime ?? course.schedule.startTime,
    duration: l.duration ?? course.schedule.duration
  }));
}

function saveCourse() {
  if (!courseForm.name.trim()) {
    message.warning("请填写课程名称");
    return;
  }
  if (!courseForm.subject) {
    message.warning("请选择科目");
    return;
  }
  if (courseForm.scope === "personal" && !courseForm.studentId) {
    message.warning("请选择一个小孩");
    return;
  }
  if (courseForm.scope !== "personal" && !courseForm.groupId) {
    message.warning("请选择班级或小组");
    return;
  }
  if (courseForm.scheduleMode === "specific" && courseForm.schedule.dates.length === 0) {
    message.warning("请至少选择一个上课日期");
    return;
  }
  
  const courseData = {
    name: courseForm.name.trim(),
    subject: courseForm.subject,
    totalLessons: courseForm.totalLessons,
    lessons: courseForm.lessons.map((l, i) => ({
      id: l.id,
      title: l.title || `第${i + 1}课`,
      materialIds: l.materialIds,
      order: i,
      date: l.date,
      startTime: l.startTime,
      duration: l.duration
    })),
    scope: courseForm.scope,
    groupId: courseForm.groupId ?? undefined,
    studentIds: courseForm.scope === "personal" && courseForm.studentId ? [courseForm.studentId] : [],
    scheduleMode: courseForm.scheduleMode,
    schedule: {
      startDate: courseForm.scheduleMode === "specific" ? courseForm.schedule.dates[0] : courseForm.schedule.startDate,
      dates: courseForm.scheduleMode === "specific" ? [...courseForm.schedule.dates] : undefined,
      startTime: courseForm.schedule.startTime,
      duration: courseForm.schedule.duration,
      weekday: courseForm.scheduleMode === "weekly" || courseForm.scheduleMode === "biweekly" ? courseForm.schedule.weekday : undefined
    }
  };
  
  if (editingCourseId.value) {
    workspace.updateCourse(editingCourseId.value, courseData);
    const oldStudents = workspace.getCourseStudents(editingCourseId.value).map((s) => s.id);
    let newStudents: string[] = [];
    if (courseForm.scope === "personal" && courseForm.studentId) {
      newStudents = [courseForm.studentId];
    } else if (courseForm.groupId) {
      const group = workspace.groups.find((g) => g.id === courseForm.groupId);
      if (group) newStudents = [...group.memberIds];
    }
    for (const sid of oldStudents) {
      if (!newStudents.includes(sid)) {
        workspace.unassignCourseFromStudent(editingCourseId.value, sid);
      }
    }
    for (const sid of newStudents) {
      if (!oldStudents.includes(sid)) {
        workspace.assignCourseToStudent(editingCourseId.value, sid);
      }
    }
    message.success("课程已更新");
    syncCoursesToSchedule();
  } else {
    const courseId = workspace.createCourse(courseData);
    if (courseForm.scope === "personal" && courseForm.studentId) {
      workspace.assignCourseToStudent(courseId, courseForm.studentId);
    } else if (courseForm.groupId) {
      const group = workspace.groups.find((g) => g.id === courseForm.groupId);
      if (group) {
        for (const sid of group.memberIds) {
          workspace.assignCourseToStudent(courseId, sid);
        }
      }
    }
    message.success("课程已创建");
    syncCoursesToSchedule();
  }
  pageMode.value = "calendar";
}

function deleteCourse() {
  if (!editingCourseId.value) return;
  confirmDelete({
    content: "确定要删除这门课程吗？相关课时也将被删除。",
    onOk: () => {
      workspace.deleteCourse(editingCourseId.value!);
      message.success("课程已删除");
      pageMode.value = "calendar";
    }
  });
}

function addLesson() {
  const index = courseForm.lessons.length;
  const lastDate = courseForm.lessons.length > 0 ? courseForm.lessons[courseForm.lessons.length - 1].date : courseForm.schedule.dates[0] || courseForm.schedule.startDate;
  courseForm.lessons.push({
    id: `lesson-${Date.now()}-${index}`,
    title: `第${index + 1}课`,
    materialIds: [],
    order: index,
    date: lastDate,
    startTime: courseForm.schedule.startTime,
    duration: courseForm.schedule.duration
  });
  courseForm.totalLessons = courseForm.lessons.length;
}

function removeLesson(index: number) {
  courseForm.lessons.splice(index, 1);
  courseForm.lessons.forEach((l, i) => { l.order = i; });
  courseForm.totalLessons = courseForm.lessons.length;
}

const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const dragOverPosition = ref<"top" | "bottom">("bottom");
const isDragging = ref(false);
const dragStartY = ref(0);
const dragClone = ref<HTMLElement | null>(null);

function onDragStart(index: number, event: MouseEvent) {
  dragIndex.value = index;
  isDragging.value = true;
  dragStartY.value = event.clientY;

  const el = (event.currentTarget as HTMLElement).closest('.lesson-item') as HTMLElement;
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.add('drag-clone');
  clone.style.position = 'fixed';
  clone.style.width = el.offsetWidth + 'px';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.opacity = '0.85';
  clone.style.transform = 'rotate(2deg)';
  document.body.appendChild(clone);
  dragClone.value = clone;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragMouseUp);
}

function onDragMove(event: MouseEvent) {
  if (!isDragging.value || !dragClone.value) return;
  dragClone.value.style.left = (event.clientX - 20) + 'px';
  dragClone.value.style.top = (event.clientY - 15) + 'px';

  const items = document.querySelectorAll('.lesson-item');
  let bestIdx: number | null = null;
  let bestDist = Infinity;
  items.forEach((item, idx) => {
    if (idx === dragIndex.value) return;
    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dist = Math.abs(event.clientY - midY);
    if (event.clientY >= rect.top - 10 && event.clientY <= rect.bottom + 10 && dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
      dragOverPosition.value = event.clientY < midY ? 'top' : 'bottom';
    }
  });
  dragOverIndex.value = bestIdx;
}

function onDragMouseUp() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragMouseUp);
  if (dragClone.value) {
    dragClone.value.remove();
    dragClone.value = null;
  }
  if (dragIndex.value !== null && dragOverIndex.value !== null && dragIndex.value !== dragOverIndex.value) {
    const from = dragIndex.value;
    let to = dragOverIndex.value;
    if (dragOverPosition.value === 'bottom' && from < to) to++;
    if (dragOverPosition.value === 'top' && from > to) to--;
    const item = courseForm.lessons.splice(from, 1)[0];
    courseForm.lessons.splice(to, 0, item);
    courseForm.lessons.forEach((l, i) => { l.order = i; });
  }
  dragIndex.value = null;
  dragOverIndex.value = null;
  isDragging.value = false;
}

function updateLessonCount() {
  const count = Math.max(courseForm.totalLessons, 1);
  while (courseForm.lessons.length < count) {
    const i = courseForm.lessons.length;
    const lastDate = courseForm.lessons.length > 0 ? courseForm.lessons[courseForm.lessons.length - 1].date : courseForm.schedule.dates[0] || courseForm.schedule.startDate;
    courseForm.lessons.push({
      id: `lesson-${Date.now()}-${i}`,
      title: `第${i + 1}课`,
      materialIds: [],
      order: i,
      date: lastDate,
      startTime: courseForm.schedule.startTime,
      duration: courseForm.schedule.duration
    });
  }
  if (courseForm.lessons.length > count) {
    courseForm.lessons.splice(count);
  }
  courseForm.totalLessons = courseForm.lessons.length;
}

function goBack() {
  pageMode.value = "calendar";
}

function handleCalendarClick(item: CalendarLessonItem) {
  if (item.kind === "group") return;
  const lesson = workspace.scheduledLessons.find((l) => l.id === item.lessonId);
  if (lesson?.courseId) {
    editCourse(lesson.courseId);
  }
}

function returnToToday() {
  calendarAnchor.value = Date.now();
}

function shiftCalendar(direction: 1 | -1) {
  calendarAnchor.value = shiftCalendarAnchor(calendarMode.value, calendarAnchor.value, direction);
}

function scrollDayViewToMorning() {
  nextTick(() => {
    if (dayGridRef.value) {
      dayGridRef.value.scrollTop = 8 * hourHeight;
    }
  });
}

function nextHour(): number {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return now.getTime();
}

function syncCoursesToSchedule() {
  let created = 0;
  let deleted = 0;
  let skipped = 0;
  
  const validCourseKeys = new Set<string>();
  for (const course of workspace.courses) {
    if (!course.schedule?.startDate || !course.schedule.startTime) {
      skipped++;
      continue;
    }
    
    let courseStudentsList = workspace.getCourseStudents(course.id);
    
    if (courseStudentsList.length === 0 && course.scope !== "personal" && course.groupId) {
      const group = workspace.groups.find((g) => g.id === course.groupId);
      if (group && group.memberIds.length === 0) {
        for (const child of workspace.items) {
          workspace.addStudentToGroup(course.groupId, child.id);
          workspace.assignCourseToStudent(course.id, child.id);
        }
        courseStudentsList = workspace.getCourseStudents(course.id);
      } else if (group && group.memberIds.length > 0) {
        for (const sid of group.memberIds) {
          workspace.assignCourseToStudent(course.id, sid);
        }
        courseStudentsList = workspace.getCourseStudents(course.id);
      }
    }
    
    const isClassScope = course.scope !== "personal";
    
    if (isClassScope) {
      const dummyStudentId = `class:${course.id}`;
      validCourseKeys.add(`${dummyStudentId}:${course.subject}`);
      
      for (let i = 0; i < course.totalLessons; i++) {
        let lessonDate: Date;
        let lessonTimeStr = course.schedule.startTime;
        let lessonDuration = course.schedule.duration || 90;
        
        if (course.lessons[i]?.date) {
          lessonDate = new Date(course.lessons[i].date!);
        } else if (course.scheduleMode === "specific" && course.schedule.dates && course.schedule.dates.length > 0) {
          if (i >= course.schedule.dates.length) break;
          lessonDate = new Date(course.schedule.dates[i]);
        } else {
          lessonDate = new Date(course.schedule.startDate);
          if (course.scheduleMode === "weekly") {
            lessonDate.setDate(lessonDate.getDate() + i * 7);
          } else if (course.scheduleMode === "biweekly") {
            lessonDate.setDate(lessonDate.getDate() + i * 14);
          } else {
            lessonDate.setDate(lessonDate.getDate() + i * 7);
          }
        }
        
        if (course.lessons[i]?.startTime) {
          lessonTimeStr = course.lessons[i].startTime!;
        }
        if (course.lessons[i]?.duration) {
          lessonDuration = course.lessons[i].duration!;
        }
        
        const [hours, minutes] = lessonTimeStr.split(":").map(Number);
        lessonDate.setHours(hours, minutes || 0, 0, 0);
        const startsAt = lessonDate.getTime();
        
        const exists = workspace.scheduledLessons.some(
          (l) => l.courseId === course.id && l.studentId === dummyStudentId && l.lessonIndex === i
        );
        
        if (!exists) {
          workspace.createScheduledLesson({
            courseId: course.id,
            lessonIndex: i,
            studentId: dummyStudentId,
            subject: course.subject,
            startsAt,
            durationMinutes: lessonDuration,
            topic: course.lessons[i]?.title ?? `第${i + 1}课`,
            note: ""
          });
          created++;
        }
      }
    } else {
      for (const student of courseStudentsList) {
        validCourseKeys.add(`${student.id}:${course.subject}`);
        
        for (let i = 0; i < course.totalLessons; i++) {
          let lessonDate: Date;
          let lessonTimeStr = course.schedule.startTime;
          let lessonDuration = course.schedule.duration || 90;
          
          if (course.lessons[i]?.date) {
            lessonDate = new Date(course.lessons[i].date!);
          } else if (course.scheduleMode === "specific" && course.schedule.dates && course.schedule.dates.length > 0) {
            if (i >= course.schedule.dates.length) break;
            lessonDate = new Date(course.schedule.dates[i]);
          } else {
            lessonDate = new Date(course.schedule.startDate);
            if (course.scheduleMode === "weekly") {
              lessonDate.setDate(lessonDate.getDate() + i * 7);
            } else if (course.scheduleMode === "biweekly") {
              lessonDate.setDate(lessonDate.getDate() + i * 14);
            } else {
              lessonDate.setDate(lessonDate.getDate() + i * 7);
            }
          }
          
          if (course.lessons[i]?.startTime) {
            lessonTimeStr = course.lessons[i].startTime!;
          }
          if (course.lessons[i]?.duration) {
            lessonDuration = course.lessons[i].duration!;
          }
          
          const [hours, minutes] = lessonTimeStr.split(":").map(Number);
          lessonDate.setHours(hours, minutes || 0, 0, 0);
          const startsAt = lessonDate.getTime();
          
          const exists = workspace.scheduledLessons.some(
            (l) => l.courseId === course.id && l.studentId === student.id && l.lessonIndex === i
          );
          
          if (!exists) {
            workspace.createScheduledLesson({
              courseId: course.id,
              lessonIndex: i,
              studentId: student.id,
              subject: course.subject,
              startsAt,
              durationMinutes: lessonDuration,
              topic: course.lessons[i]?.title ?? `第${i + 1}课`,
              note: ""
            });
            created++;
          }
        }
      }
    }
  }
  
  const toDelete = workspace.scheduledLessons.filter((lesson) => {
    const key = `${lesson.studentId}:${lesson.subject}`;
    if (!validCourseKeys.has(key)) return true;
    const lc = workspace.courses.find((c) => c.id === lesson.courseId);
    if (lc && lc.scope !== "personal" && !lesson.studentId.startsWith("class:")) return true;
    return false;
  });
  
  for (const lesson of toDelete) {
    workspace.deleteScheduledLesson(lesson.id);
    deleted++;
  }
  
  const parts = [];
  if (created > 0) parts.push(`新增 ${created} 条`);
  if (deleted > 0) parts.push(`删除 ${deleted} 条`);
  if (parts.length > 0) {
    message.success(`课程表已同步：${parts.join("，")}`);
  } else {
    message.info(`没有需要同步的变更（跳过 ${skipped} 个不完整的课程配置）`);
  }
}

watch(calendarMode, () => {
  scrollDayViewToMorning();
});

function onStartDateChange(dateStr: string) {
  if (!dateStr) return;
  courseForm.schedule.weekday = new Date(dateStr).getDay();
  courseForm.schedule.dates = [dateStr];
}

function onSpecificDatePick(ts: number | null) {
  if (!ts) return;
  const d = new Date(ts);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (!courseForm.schedule.dates.includes(dateStr)) {
    courseForm.schedule.dates.push(dateStr);
    courseForm.schedule.dates.sort();
  }
}

function removeDate(index: number) {
  courseForm.schedule.dates.splice(index, 1);
}

watch(() => specificDates.value, (val) => {
  courseForm.schedule.dates = val.map((ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  if (courseForm.schedule.dates.length > 0) {
    courseForm.schedule.startDate = courseForm.schedule.dates[0];
    courseForm.schedule.weekday = new Date(courseForm.schedule.dates[0]).getDay();
  }
}, { deep: true });

const weekdayLabel = computed(() => {
  return getWeekdayLabel(courseForm.schedule.weekday);
});
</script>

<template>
  <div class="schedule-page">
    <template v-if="pageMode === 'calendar'">
      <div class="page-top sticky-top">
        <div class="page-top-row">
          <div>
            <h1 class="page-title">课程表</h1>
            <p class="page-subtitle">按日、周、月查看课程安排，或切换到列表视图查看所有课程详情。</p>
          </div>
          <n-space align="center">
            <!-- 视图切换：日历/列表 -->
            <div class="view-switch">
              <button
                type="button"
                class="view-switch-btn"
                :class="{ active: viewMode === 'calendar' }"
                @click="viewMode = 'calendar'"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                日历
              </button>
              <button
                type="button"
                class="view-switch-btn"
                :class="{ active: viewMode === 'list' }"
                @click="viewMode = 'list'"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                列表
              </button>
            </div>
            <n-button type="primary" @click="openCreateCourse" v-if="props.userRole !== 'parent'">
              <template #icon><Plus :size="16" /></template>
              新建课程
            </n-button>
          </n-space>
        </div>
        <!-- 日历视图的子视图切换（第二行） -->
        <div class="page-top-row calendar-toolbar" :class="{ 'toolbar-hidden': viewMode !== 'calendar' }">
          <div class="calendar-view-switch">
            <div class="calendar-mode-buttons" role="group">
              <button
                v-for="option in modeOptions"
                :key="option.value"
                type="button"
                class="calendar-mode-button"
                :class="{ active: calendarMode === option.value }"
                @click="calendarMode = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <n-space align="center" :size="6">
            <n-button secondary circle size="small" aria-label="上一页" @click="shiftCalendar(-1)">‹</n-button>
            <n-button secondary size="small" @click="returnToToday">今天</n-button>
            <n-button secondary circle size="small" aria-label="下一页" @click="shiftCalendar(1)">›</n-button>
            <n-tag round size="small">{{ titleText }}</n-tag>
          </n-space>
        </div>
      </div>

      <!-- ====== 日历视图 ====== -->
      <template v-if="viewMode === 'calendar'">
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
                @click="openCreateCourse(cell.start + 18 * 60 * 60 * 1000)"
              >
                <span>{{ cell.dayNumber }}</span>
                <div
                  v-for="item in itemsForDay(cell.start, cell.end)"
                  :key="item.key"
                  class="schedule-month-lesson"
                  :class="{ 'schedule-month-lesson-group': item.kind === 'group' }"
                  :style="lessonBorderStyle(item)"
                  @click.stop="handleCalendarClick(item)"
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
                <div class="schedule-week-day-header">
                  <span>{{ day.label }}</span>
                  <span>{{ day.dateLabel }}</span>
                </div>
                <div class="schedule-week-hours">
                  <div v-for="hour in hours" :key="hour" class="schedule-week-hour" @click="openCreateCourse(day.start + hour * 60 * 60 * 1000)">
                    <div v-for="item in itemsForHour(day.start + hour * 60 * 60 * 1000)" :key="item.key" class="schedule-week-lesson" :style="lessonBorderStyle(item)" @click.stop="handleCalendarClick(item)">
                      <template v-if="item.kind === 'group'">
                        <strong :style="{ color: item.groupColor }">{{ item.groupName }}</strong>
                        <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                        <span class="schedule-lesson-class-dot" :style="{ background: item.groupColor }" />
                      </template>
                      <template v-else>
                        <strong>{{ item.studentName }}</strong>
                        <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                        <span v-if="lessonGroupColor(item)" class="schedule-lesson-class-dot" :style="{ background: lessonGroupColor(item) }" />
                      </template>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </template>

          <template v-else-if="calendarMode === 'day'">
            <div class="schedule-day-head">
              <span>{{ dayView.label }}</span>
              <span>{{ dayView.dateLabel }}</span>
            </div>
            <div ref="dayGridRef" class="schedule-day-grid">
              <div v-for="hour in hours" :key="hour" class="schedule-day-hour" @click="openCreateCourse(dayView.start + hour * 60 * 60 * 1000)">
                <div class="schedule-day-hour-label">{{ hour }}:00</div>
                <div class="schedule-day-hour-content">
                  <div v-for="item in itemsForHour(dayView.start + hour * 60 * 60 * 1000)" :key="item.key" class="schedule-day-lesson" :style="lessonBorderStyle(item)" @click.stop="handleCalendarClick(item)">
                    <template v-if="item.kind === 'group'">
                      <strong :style="{ color: item.groupColor }">{{ item.groupName }}</strong>
                      <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                      <span class="schedule-lesson-class-dot" :style="{ background: item.groupColor }" />
                    </template>
                    <template v-else>
                      <strong>{{ item.studentName }}</strong>
                      <em>{{ item.subject }} · {{ item.durationMinutes }} 分钟</em>
                      <span v-if="lessonGroupColor(item)" class="schedule-lesson-class-dot" :style="{ background: lessonGroupColor(item) }" />
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </section>
      </template>

      <!-- ====== 列表视图（课程列表） ====== -->
      <template v-else>
        <div class="list-view">
          <!-- 筛选栏 -->
          <div class="list-filter-bar">
            <n-select
              v-model:value="listFilterSubject"
              :options="listSubjectOptions"
              placeholder="按科目筛选"
              clearable
              size="small"
              style="width: 150px;"
            />
            <span class="list-count">共 {{ filteredCourses.length }} 门课程</span>
            <n-button v-if="props.userRole !== 'parent'" size="small" type="primary" @click="openCreateCourse">
              <template #icon><Plus :size="14" /></template>
              新建课程
            </n-button>
          </div>

          <!-- 空状态 -->
          <div v-if="filteredCourses.length === 0" class="empty-state">
            <p>暂无课程</p>
            <p class="empty-hint">点击「新建课程」创建课程</p>
          </div>

          <!-- 课程列表 -->
          <div v-else class="course-list">
            <div
              v-for="course in filteredCourses"
              :key="course.id"
              class="course-card"
              :style="course.groupId ? { borderLeftColor: workspace.groups.find(g => g.id === course.groupId)?.color || 'var(--border)' } : {}"
            >
              <!-- 课程头部 -->
              <div class="course-card-header" @click="toggleCourseExpand(course.id)">
                <div class="course-card-info">
                  <span class="course-subject-badge">{{ course.subject }}</span>
                  <div class="course-card-main">
                    <strong>{{ course.name }}</strong>
                  </div>
                  <span class="course-card-schedule">
                    {{ course.schedule.startDate }} 起 {{ getScheduleModeLabel(course.scheduleMode) }}{{ course.schedule.weekday ? ' ' + getWeekdayLabel(course.schedule.weekday) : '' }} {{ course.schedule.startTime }}
                  </span>
                  <span class="course-card-scope">
                    {{ course.scope === 'personal' ? getCourseStudents(course.id).map(s => s.name).join('、') : (workspace.groups.find(g => g.id === course.groupId)?.name ?? '班级/小组') }}
                  </span>
                </div>
                <svg :class="{ expanded: isCourseExpanded(course.id) }" class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              <!-- 展开详情：仅课时列表 -->
              <div v-if="isCourseExpanded(course.id)" class="course-card-detail">
                <div class="course-lessons-section">
                  <div v-if="getCourseLessons(course.id).length === 0" class="no-lessons">暂未生成课时，请点击「同步课程信息」</div>
                  <div v-else class="course-lessons-table">
                    <div class="lessons-table-header">
                      <span class="lesson-col-index">#</span>
                      <span class="lesson-col-title">标题</span>
                      <span class="lesson-col-date">日期</span>
                      <span class="lesson-col-time">时间</span>
                      <span class="lesson-col-student">学生</span>
                    </div>
                    <div
                      v-for="(lesson, li) in getCourseLessons(course.id)"
                      :key="lesson.id"
                      class="course-lesson-row"
                    >
                      <span class="lesson-index">{{ lesson.lessonIndex + 1 }}</span>
                      <span class="lesson-title">{{ lesson.topic || '第' + (lesson.lessonIndex + 1) + '课' }}</span>
                      <span class="lesson-date">{{ formatListDate(lesson.startsAt) }}</span>
                      <span class="lesson-time">{{ formatListTime(lesson.startsAt) }}</span>
                      <span class="lesson-student">{{ lesson.studentId.startsWith('class:') ? '班级课程' : (workspace.items.find(s => s.id === lesson.studentId)?.name ?? lesson.studentId) }}</span>
                    </div>
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="course-detail-actions" v-if="props.userRole !== 'parent'">
                  <n-button size="small" secondary @click="editCourse(course.id)">编辑课程</n-button>
                  <n-button size="small" secondary type="error" @click="editingCourseId = course.id; deleteCourse()">删除课程</n-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ====== 新建/编辑课程表单 ====== -->
    <template v-else>
      <div class="schedule-form-wrapper">
        <div class="page-top schedule-form-header">
          <div class="page-top-row">
            <div>
              <h1 class="page-title">{{ editingCourseId ? "编辑课程" : "新建课程" }}</h1>
              <p class="page-subtitle">设置课程信息、时间安排和课时内容。</p>
            </div>
            <n-button secondary @click="goBack">
              <template #icon><ArrowLeft :size="16" /></template>
              返回课程表
            </n-button>
          </div>
        </div>
        <section class="schedule-form-body">
        <div class="form-grid">
          <!-- 左列：基本信息 -->
          <div class="form-column">
            <h3 class="form-section-title">基本信息</h3>
            <n-form label-placement="top">
              <n-form-item label="课程名称" :validation-status="courseForm.name.trim() ? undefined : 'error'" :feedback="courseForm.name.trim() ? undefined : '请填写课程名称'">
                <n-input v-model:value="courseForm.name" placeholder="例如：数学培优班" />
              </n-form-item>
              <n-form-item label="科目" :validation-status="courseForm.subject ? undefined : 'error'" :feedback="courseForm.subject ? undefined : '请选择科目'">
                <n-select v-model:value="courseForm.subject" :options="subjectOptions" />
              </n-form-item>
              <n-form-item label="课程归属">
                <n-radio-group v-model:value="courseForm.scope">
                  <n-radio value="personal">个人课程</n-radio>
                  <n-radio value="class">班级/小组</n-radio>
                </n-radio-group>
              </n-form-item>
              <n-form-item v-if="courseForm.scope === 'personal'" label="关联小孩">
                <n-select v-model:value="courseForm.studentId" :options="childOptions" placeholder="选择小孩" clearable />
              </n-form-item>
              <n-form-item v-else label="关联班级/小组">
                <n-select v-model:value="courseForm.groupId" :options="groupOptions" placeholder="选择班级或小组" />
              </n-form-item>
            </n-form>
          </div>

          <!-- 右列：时间设置 -->
          <div class="form-column">
            <h3 class="form-section-title">时间设置</h3>
            <n-form label-placement="top">
              <n-form-item label="时间模式">
                <n-select v-model:value="courseForm.scheduleMode" :options="scheduleModeOptions" />
              </n-form-item>
              <n-form-item v-if="courseForm.scheduleMode === 'specific'" label="上课日期（可多选）">
                <div class="specific-dates-wrapper">
                  <div class="selected-dates" v-if="courseForm.schedule.dates.length > 0">
                    <n-tag v-for="(d, i) in courseForm.schedule.dates" :key="d" closable size="small" @close="removeDate(i)">
                      {{ d }}
                    </n-tag>
                  </div>
                  <n-date-picker
                    v-model:value="specificDates"
                    type="date"
                    teleport="body"
                    style="width: 100%;"
                    :on-update:value="onSpecificDatePick"
                  />
                </div>
              </n-form-item>
              <template v-else>
                <n-form-item label="开始日期">
                  <n-date-picker
                    v-model:formatted-value="courseForm.schedule.startDate"
                    type="date"
                    value-format="yyyy-MM-dd"
                    teleport="body"
                    style="width: 100%;"
                    :on-update:formatted-value="onStartDateChange"
                  />
                </n-form-item>
                <n-form-item label="上课星期">
                  <n-tag :bordered="false" type="info">{{ weekdayLabel }}（自动推算）</n-tag>
                </n-form-item>
              </template>
              <n-form-item label="上课时间">
                <n-time-picker
                  v-model:formatted-value="courseForm.schedule.startTime"
                  format="HH:mm"
                  value-format="HH:mm"
                  style="width: 100%;"
                />
              </n-form-item>
              <n-form-item label="课程时长（分钟）">
                <n-select v-model:value="courseForm.schedule.duration" :options="durationOptions" />
              </n-form-item>
              <n-form-item label="课时数量">
                <n-input-number v-model:value="courseForm.totalLessons" :min="1" :max="100" @update:value="updateLessonCount" />
              </n-form-item>
            </n-form>
          </div>
        </div>

        <!-- 课时列表 -->
        <div class="lessons-section">
          <h3 class="form-section-title">课时列表（{{ courseForm.lessons.length }} 节）</h3>
          <div class="lessons-table-header">
            <span class="lesson-col-handle"></span>
            <span class="lesson-col-index">#</span>
            <span class="lesson-col-title">课时标题</span>
            <span class="lesson-col-date">日期</span>
            <span class="lesson-col-time">时间</span>
            <span class="lesson-col-duration">时长</span>
            <span class="lesson-col-materials">关联资料</span>
            <span class="lesson-col-actions">操作</span>
          </div>
          <div class="lessons-list">
            <div
              v-for="(lesson, index) in courseForm.lessons"
              :key="lesson.id"
              class="lesson-item"
              :class="{ 'drag-over-top': dragOverIndex === index && dragOverPosition === 'top', 'drag-over-bottom': dragOverIndex === index && dragOverPosition === 'bottom', 'dragging': dragIndex === index }"
            >
              <div class="lesson-drag-handle" @mousedown="onDragStart(index, $event)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
              </div>
              <span class="lesson-index">{{ index + 1 }}</span>
              <n-input
                v-model:value="lesson.title"
                :placeholder="`第${index + 1}课`"
                size="small"
                class="lesson-title-input"
              />
              <div class="lesson-date-cell">
                <n-date-picker
                  v-model:formatted-value="lesson.date"
                  type="date"
                  value-format="yyyy-MM-dd"
                  teleport="body"
                  size="small"
                  style="width: 100%;"
                />
              </div>
              <div class="lesson-time-cell">
                <n-time-picker
                  v-model:formatted-value="lesson.startTime"
                  format="HH:mm"
                  value-format="HH:mm"
                  size="small"
                  style="width: 100%;"
                />
              </div>
              <div class="lesson-duration-cell">
                <n-select
                  v-model:value="lesson.duration"
                  :options="durationOptions"
                  size="small"
                  style="width: 90px;"
                />
              </div>
              <div class="lesson-materials-cell">
                <n-select
                  v-model:value="lesson.materialIds"
                  :options="materialOptions"
                  multiple
                  placeholder="选择资料"
                  size="small"
                  :max-tag-count="1"
                />
              </div>
              <n-popconfirm @positive-click="removeLesson(index)">
                <template #trigger>
                  <n-button quaternary circle size="small" type="error">
                    <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14M10 11v6M14 11v6"/></svg></template>
                  </n-button>
                </template>
                确定删除此课时？
              </n-popconfirm>
            </div>
          </div>
          <button type="button" class="add-lesson-btn" @click="addLesson">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
            添加课时
          </button>
        </div>

        <div class="form-actions">
          <n-space>
            <n-button type="primary" @click="saveCourse">{{ editingCourseId ? "保存" : "创建" }}</n-button>
            <n-button secondary @click="goBack">取消</n-button>
          </n-space>
          <n-popconfirm v-if="editingCourseId" @positive-click="deleteCourse">
            <template #trigger>
              <n-button secondary type="error">删除课程</n-button>
            </template>
            确定要删除这门课程吗？相关课时也将被删除。
          </n-popconfirm>
        </div>
      </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 视图切换 */
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--body-bg);
  padding-bottom: 8px;
}

.page-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.calendar-toolbar {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.calendar-toolbar.toolbar-hidden {
  visibility: hidden;
  pointer-events: none;
  border-color: transparent;
}

.view-switch {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-switch-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: var(--panel);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.view-switch-btn:hover {
  background: var(--bg-elevated);
  color: var(--text);
}

.view-switch-btn.active {
  background: var(--primary);
  color: #fff;
}

/* 日历视图切换 */
.calendar-view-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.calendar-mode-buttons {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.calendar-mode-button {
  padding: 4px 10px;
  border: none;
  background: var(--panel);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.calendar-mode-button:hover {
  background: var(--bg-elevated);
  color: var(--text);
}

.calendar-mode-button.active {
  background: var(--primary);
  color: #fff;
}

/* 列表视图 */
.list-view {
  display: grid;
  gap: 12px;
}

.list-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
}

.list-count {
  font-size: 12px;
  color: var(--muted);
  margin-left: auto;
}

/* 课程列表 */
.course-list {
  display: grid;
  gap: 12px;
}

.course-card {
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.course-card:hover {
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: var(--shadow-sm);
}

.course-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}

.course-card-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.course-subject-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 14px;
  font-weight: 800;
  flex-shrink: 0;
}

.course-card-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.course-card-main strong {
  font-size: 15px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.course-card-schedule {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.course-card-scope {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.expand-icon {
  transition: transform 0.2s;
  color: var(--muted);
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.course-card-detail {
  border-top: 1px solid var(--border);
  padding: 16px;
}

.course-detail-section {
  display: grid;
  gap: 4px;
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  font-size: 13px;
}

.detail-label {
  min-width: 70px;
  color: var(--muted);
  flex-shrink: 0;
}

.course-lessons-section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.no-lessons {
  padding: 12px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
}

.course-lessons-table {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.lessons-table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.course-lesson-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  transition: background 0.15s;
}

.course-lesson-row:last-child {
  border-bottom: none;
}

.course-lesson-row:hover {
  background: var(--bg-elevated);
}

.lesson-index {
  width: 24px;
  text-align: center;
  font-weight: 700;
  color: var(--muted);
}

.lesson-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-date {
  min-width: 80px;
  color: var(--muted);
}

.lesson-time {
  min-width: 50px;
  color: var(--text);
  font-weight: 600;
}

.lesson-student {
  min-width: 60px;
  color: var(--muted-strong);
}

.course-detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
}

.empty-hint {
  font-size: 13px;
}

/* 日历相关样式继承全局 */
.schedule-calendar {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  overflow: auto;
}

.schedule-month-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.schedule-month-head > div {
  padding: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.schedule-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.schedule-month-cell {
  min-height: 80px;
  padding: 4px;
  border: 1px solid var(--border);
  border-top: none;
  border-left: none;
  background: var(--panel);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  transition: background 0.15s;
}

.schedule-month-cell:hover {
  background: var(--bg-elevated);
}

.schedule-month-cell.muted {
  opacity: 0.5;
}

.schedule-month-cell.today {
  background: var(--primary-soft);
}

.schedule-month-cell span:first-child {
  font-weight: 700;
  color: var(--text);
}

.schedule-month-lesson {
  margin: 2px 0;
  padding: 2px 4px;
  border-radius: 4px;
  border-left: 3px solid var(--border);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}

.schedule-month-lesson:hover {
  background: var(--bg-elevated);
}

.schedule-month-lesson strong {
  display: block;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-month-lesson em {
  display: block;
  font-size: 10px;
  color: var(--muted);
  font-style: normal;
}

.schedule-group-hover-list {
  position: absolute;
  z-index: 10;
  padding: 4px 8px;
  background: var(--panel-solid);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--shadow-md);
  font-size: 11px;
}

.schedule-lesson-class-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

/* 周视图 */
.schedule-week-list {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  min-height: 400px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.schedule-week-day {
  border-right: 1px solid var(--border);
}

.schedule-week-day:last-child {
  border-right: none;
}

.schedule-week-day-header {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}

.schedule-week-hours {
  display: flex;
  flex-direction: column;
}

.schedule-week-hour {
  min-height: 44px;
  border-bottom: 1px solid var(--border);
  padding: 2px;
  cursor: pointer;
  transition: background 0.15s;
}

.schedule-week-hour:hover {
  background: var(--bg-elevated);
}

.schedule-week-lesson {
  padding: 2px 4px;
  border-radius: 4px;
  border-left: 3px solid var(--border);
  font-size: 11px;
  cursor: pointer;
  margin-bottom: 2px;
}

.schedule-week-lesson:hover {
  background: var(--bg-elevated);
}

.schedule-week-lesson strong {
  display: block;
  font-size: 11px;
}

.schedule-week-lesson em {
  font-size: 10px;
  color: var(--muted);
  font-style: normal;
}

/* 日视图 */
.schedule-day-head {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  font-weight: 700;
}

.schedule-day-grid {
  max-height: 500px;
  overflow-y: auto;
}

.schedule-day-hour {
  display: grid;
  grid-template-columns: 60px 1fr;
  min-height: 44px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s;
}

.schedule-day-hour:hover {
  background: var(--bg-elevated);
}

.schedule-day-hour-label {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}

.schedule-day-hour-content {
  padding: 2px;
}

.schedule-day-lesson {
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid var(--border);
  margin-bottom: 2px;
  cursor: pointer;
}

.schedule-day-lesson:hover {
  background: var(--bg-elevated);
}

.schedule-day-lesson strong {
  display: block;
  font-size: 13px;
}

.schedule-day-lesson em {
  font-size: 12px;
  color: var(--muted);
  font-style: normal;
}

/* 表单页 */
.schedule-form-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.schedule-form-header {
  flex-shrink: 0;
  background: var(--body-bg);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.schedule-form-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-section-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  padding-bottom: 8px;
  padding-left: 10px;
  border-bottom: 1px solid var(--border);
  border-left: 3px solid var(--primary);
}

.lessons-section {
  margin-top: 16px;
}

.lessons-table-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.lessons-list {
  display: grid;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  overflow: hidden;
}

.lesson-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.lesson-item:last-child {
  border-bottom: none;
}

.lesson-item:hover {
  background: var(--bg-elevated);
}

.lesson-col-handle { width: 24px; }
.lesson-col-index { width: 32px; text-align: center; }
.lesson-col-title { flex: 1; }
.lesson-col-date { width: 120px; }
.lesson-col-time { width: 100px; }
.lesson-col-duration { width: 90px; }
.lesson-col-materials { width: 150px; }
.lesson-col-actions { width: 50px; text-align: center; }

.lesson-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  cursor: grab;
  color: var(--muted);
  transition: color 0.15s;
  flex-shrink: 0;
}

.lesson-drag-handle:hover {
  color: var(--primary);
}

.lesson-item.dragging {
  opacity: 0.4;
  background: var(--surface-soft);
}

.lesson-item.drag-over-top {
  border-top: 2px solid var(--primary);
}

.lesson-item.drag-over-bottom {
  border-bottom: 2px solid var(--primary);
}

.drag-clone {
  background: var(--panel-solid);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.drag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s;
}

.drag-btn:hover:not(:disabled) {
  background: var(--primary-soft);
  color: var(--primary);
  transform: scale(1.1);
}

.drag-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.lesson-index {
  width: 32px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.lesson-title-input {
  flex: 1;
  min-width: 0;
}

.lesson-date-cell {
  width: 120px;
}

.lesson-time-cell {
  width: 100px;
}

.lesson-duration-cell {
  width: 100px;
}

.lesson-materials-cell {
  width: 180px;
}

.add-lesson-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.add-lesson-btn:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
