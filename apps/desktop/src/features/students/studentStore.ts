import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

export type Course = {
  subject: string;
  currentLesson: number;
  totalLessons: number;
  progress: number;
};

export type MistakeBookSummary = {
  summary: string;
  aiPending: number;
  subjects: string[];
  weakPoints: string[];
  analysis: string;
  similarQuestions: string;
  knowledgeInsight: string;
};

export type Student = {
  id: string;
  name: string;
  gender: "male" | "female";
  goal: string;
  style: string;
  courses: Course[];
  materials: string[];
  mistakeBook: MistakeBookSummary;
};

export type StudentGroup = {
  id: string;
  name: string;
  description: string;
  type: "class" | "subject";
  color: string;
  subjects: string[];
  memberIds: string[];
};
export type StudentDraft = Pick<Student, "name" | "goal" | "style" | "courses" | "materials"> & {
  gender?: Student["gender"];
};

export type MistakeBookPatch = Partial<
  Pick<MistakeBookSummary, "analysis" | "similarQuestions" | "knowledgeInsight" | "aiPending">
>;

export type MaterialSourceProtocol = "local" | "smb" | "ftp";

export type MaterialSource = {
  id: string;
  protocol: MaterialSourceProtocol;
  name: string;
  host: string;
  path: string;
  authMethod: string;
  connectionStatus: "待测试" | "可用" | "异常";
};

export type TeachingMaterial = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  assignedStudentIds: string[];
  sourceType: MaterialSourceProtocol;
  sourcePath: string;
  syncStatus: "已索引" | "待同步" | "异常";
};

export type ScannedMaterial = {
  title: string;
  sourcePath: string;
  fileType: string;
};

export type GradingStatus = "待批改" | "已批改";

export type ClassRecord = {
  id: string;
  studentId: string;
  subject: string;
  lessonContent: string;
  performance: string;
  homework: string;
  gradingStatus: GradingStatus;
  createdAt: string;
};

export type HomeworkItem = {
  id: string;
  studentId: string;
  subject: string;
  homework: string;
  gradingStatus: GradingStatus;
  createdAt: string;
};

export type ReminderItem = {
  id: string;
  studentId: string;
  title: string;
  remindAt: number;
  relatedType: "课程" | "作业" | "批改" | "报告";
  status: "待提醒" | "已创建" | "已完成";
};

export type ScheduledLesson = {
  id: string;
  studentId: string;
  subject: string;
  startsAt: number;
  durationMinutes: number;
  topic: string;
  note: string;
};

export type ScheduledLessonDraft = Omit<ScheduledLesson, "id">;

export type ScheduledLessonCalendarItem = ScheduledLesson & {
  studentName: string;
  endsAt: number;
};

export type CalendarPlanItem = {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  time: number;
  type: "提醒" | "课堂记录";
  detail: string;
};

export type LearningReportSummary = {
  studentId: string;
  studentName: string;
  goal: string;
  style: string;
  averageProgress: number;
  classRecordCount: number;
  homeworkCount: number;
  pendingGradingCount: number;
  materialCount: number;
  weakPoints: string[];
  nextActions: string[];
};

export type AiModelConfig = {
  id: string;
  name: string;
  purpose: string;
  isDefault: boolean;
};

export type AiApiFormat = "openai-chat" | "openai-responses" | "anthropic-messages";

export type AiProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiFormat: AiApiFormat;
  models: AiModelConfig[];
  connectionStatus?: "待测试" | "可用" | "异常";
};

export type AiProviderDraft = Omit<AiProviderConfig, "id">;

export type AppThemeKey = "turquoise" | "night" | "blue" | "plum";

export type AppThemeDefinition = {
  key: AppThemeKey;
  name: string;
  description: string;
  swatches: string[];
};

export type TeacherProfile = {
  name: string;
  title: string;
  bio: string;
};

export type AppSettings = {
  aiProviders: AiProviderConfig[];
  defaultAiProviderId: string;
  defaultAiModelId: string;
  themeKey: AppThemeKey;
  teacherProfile: TeacherProfile;
};

export type DefaultAiModel = AiModelConfig & {
  providerId: string;
  providerName: string;
};

type PersistedState = {
  students: Student[];
  materials: TeachingMaterial[];
  materialSources: MaterialSource[];
  classRecords: ClassRecord[];
  reminders: ReminderItem[];
  scheduledLessons?: ScheduledLesson[];
  appSettings?: AppSettings;
};

export type { PersistedState };

const storageKey = "c-teacher.workspace.v1";

export const appThemes: AppThemeDefinition[] = [
  {
    key: "turquoise",
    name: "松石白板",
    description: "明亮、克制，适合日常备课和课堂记录。",
    swatches: ["#0d6f65", "#cc5a3c", "#f5f7f4", "#143c3a", "#ffffff"]
  },
  {
    key: "night",
    name: "墨蓝夜读",
    description: "低亮度深色界面，已提升文字对比度，适合夜间整理报告和资料。",
    swatches: ["#78d9c8", "#ffd082", "#101820", "#081018", "#f3fbff"]
  },
  {
    key: "blue",
    name: "晴蓝讲台",
    description: "清爽蓝色主题，适合长时间查看课程表和学习报告。",
    swatches: ["#1769d4", "#11a7a2", "#f4f8ff", "#123a70", "#ffffff"]
  },
  {
    key: "plum",
    name: "梅紫书房",
    description: "柔和紫调主题，适合安静的资料整理和课后复盘。",
    swatches: ["#7b4e8f", "#3f8c77", "#fbf7fb", "#36243f", "#ffffff"]
  }
];

const seedTeacherProfile: TeacherProfile = {
  name: "王老师",
  title: "课程规划老师",
  bio: "C-teacher · 本机教学工作台"
};

export const K12_MISTAKE_BOOK_SUBJECTS = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "道德与法治",
  "历史",
  "地理",
  "科学",
  "信息科技"
];
const mistakeBookSubjectSummary = `覆盖 ${K12_MISTAKE_BOOK_SUBJECTS.length} 个中小学科目`;

const seedStudents: Student[] = [
  {
    id: "chen",
    name: "陈一诺",
    gender: "female",
    goal: "期中数学 90+",
    style: "图像化讲解 + 例题驱动",
    courses: [
      { subject: "数学", currentLesson: 8, totalLessons: 16, progress: 75 },
      { subject: "英语", currentLesson: 3, totalLessons: 10, progress: 40 }
    ],
    materials: ["函数图像讲义.pdf", "练习 A 组", "阅读句型卡片"],
    mistakeBook: {
      summary: `多科目错题本 · ${mistakeBookSubjectSummary}`,
      aiPending: 3,
      subjects: K12_MISTAKE_BOOK_SUBJECTS,
      weakPoints: ["函数图像", "长难句拆解"],
      analysis: "概念理解基本到位，但图像平移与参数变化对应关系不稳定。",
      similarQuestions: "函数图像平移 3 题，参数取值判断 2 题。",
      knowledgeInsight: "函数图像掌握 72%，几何证明掌握 44%。"
    }
  },
  {
    id: "meng",
    name: "孟然",
    gender: "male",
    goal: "阅读理解稳定提分",
    style: "短任务 + 高频反馈",
    courses: [
      { subject: "语文", currentLesson: 5, totalLessons: 12, progress: 58 },
      { subject: "英语", currentLesson: 2, totalLessons: 8, progress: 30 }
    ],
    materials: ["阅读训练 A 组", "错题模板"],
    mistakeBook: {
      summary: `多科目错题本 · ${mistakeBookSubjectSummary}`,
      aiPending: 1,
      subjects: K12_MISTAKE_BOOK_SUBJECTS,
      weakPoints: ["阅读推断", "完形上下文"],
      analysis: "定位信息准确，但推断题容易忽略转折词和上下文指代。",
      similarQuestions: "推断题 4 题，指代还原 2 题。",
      knowledgeInsight: "阅读推断掌握 58%，表达题掌握 63%。"
    }
  },
  {
    id: "he",
    name: "何青",
    gender: "male",
    goal: "夯实基础",
    style: "慢节奏 + 复述确认",
    courses: [
      { subject: "数学", currentLesson: 3, totalLessons: 10, progress: 40 },
      { subject: "物理", currentLesson: 1, totalLessons: 8, progress: 18 }
    ],
    materials: ["入门讲义 01", "课堂记录模板"],
    mistakeBook: {
      summary: `多科目错题本 · ${mistakeBookSubjectSummary}`,
      aiPending: 2,
      subjects: K12_MISTAKE_BOOK_SUBJECTS,
      weakPoints: ["基础概念", "受力分析"],
      analysis: "公式记忆能跟上，但题干条件抽取和单位换算需要慢速训练。",
      similarQuestions: "基础概念辨析 5 题，受力分析入门 3 题。",
      knowledgeInsight: "基础概念掌握 40%，受力分析掌握 18%。"
    }
  }
];

export const GROUP_COLORS = [
  "#1769d4",
  "#cc5a3c",
  "#0d6f65",
  "#7b4e8f",
  "#d4962e",
  "#3f8c77",
  "#b84d8c",
  "#4a7db4"
];

const seedGroups: StudentGroup[] = [
  {
    id: "class-weekend-math",
    name: "周六数学班",
    description: "每周六下午的数学提高班",
    type: "class",
    color: GROUP_COLORS[0],
    subjects: [],
    memberIds: ["chen", "he"]
  },
  {
    id: "group-competition",
    name: "竞赛突击科目组",
    description: "为准备数学竞赛的学生开设的强化小组",
    type: "subject",
    color: GROUP_COLORS[1],
    subjects: ["数学"],
    memberIds: ["chen"]
  }
];
const seedMaterials: TeachingMaterial[] = [
  {
    id: "material-function",
    title: "函数图像讲义.pdf",
    category: "数学",
    tags: ["函数", "图像", "P0"],
    assignedStudentIds: ["chen"],
    sourceType: "local",
    sourcePath: "/Teaching/数学/函数图像讲义.pdf",
    syncStatus: "已索引"
  },
  {
    id: "material-reading",
    title: "阅读理解训练 A 组",
    category: "语文",
    tags: ["阅读", "推断"],
    assignedStudentIds: ["meng"],
    sourceType: "smb",
    sourcePath: "smb://studio-nas.local/C-teacher/reading-a",
    syncStatus: "待同步"
  }
];

const seedSources: MaterialSource[] = [
  {
    id: "source-nas",
    protocol: "smb",
    name: "工作室 NAS",
    host: "studio-nas.local",
    path: "/C-teacher/teaching-materials",
    authMethod: "系统钥匙串",
    connectionStatus: "待测试"
  }
];

const seedRecords: ClassRecord[] = [
  {
    id: "record-chen-1",
    studentId: "chen",
    subject: "数学",
    lessonContent: "函数图像与性质",
    performance: "课堂参与积极，图像变换仍需练习",
    homework: "练习 A 组第 1-8 题",
    gradingStatus: "待批改",
    createdAt: "2026-05-30T10:00:00.000Z"
  }
];

const seedReminders: ReminderItem[] = [
  {
    id: "reminder-chen-lesson",
    studentId: "chen",
    title: "陈一诺函数专题课",
    remindAt: new Date("2026-06-01T18:00:00+08:00").getTime(),
    relatedType: "课程",
    status: "已创建"
  },
  {
    id: "reminder-meng-homework",
    studentId: "meng",
    title: "批改孟然作业",
    remindAt: new Date("2026-06-02T10:00:00+08:00").getTime(),
    relatedType: "批改",
    status: "待提醒"
  }
];

const seedScheduledLessons: ScheduledLesson[] = [
  {
    id: "lesson-chen-math",
    studentId: "chen",
    subject: "数学",
    startsAt: new Date("2026-06-01T18:00:00+08:00").getTime(),
    durationMinutes: 90,
    topic: "函数图像与性质",
    note: "带函数图像讲义.pdf"
  },
  {
    id: "lesson-meng-english",
    studentId: "meng",
    subject: "英语",
    startsAt: new Date("2026-06-03T20:00:00+08:00").getTime(),
    durationMinutes: 60,
    topic: "阅读理解训练",
    note: "短任务 + 高频反馈"
  },
  {
    id: "lesson-he-physics",
    studentId: "he",
    subject: "物理",
    startsAt: new Date("2026-06-05T19:30:00+08:00").getTime(),
    durationMinutes: 90,
    topic: "受力分析入门",
    note: "慢节奏复述确认"
  }
];

const seedAppSettings: AppSettings = {
  aiProviders: [
    {
      id: "provider-openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      apiFormat: "openai-chat",
      connectionStatus: "待测试",
      models: [
        {
          id: "model-gpt-54",
          name: "gpt-5.4",
          purpose: "通用问答、备课、错题分析",
          isDefault: true
        },
        {
          id: "model-gpt-54-mini",
          name: "gpt-5.4-mini",
          purpose: "低成本任务、草稿生成",
          isDefault: false
        }
      ]
    },
    {
      id: "provider-compatible",
      name: "兼容接口",
      baseUrl: "https://api.example.com/v1",
      apiKey: "",
      apiFormat: "openai-chat",
      connectionStatus: "待测试",
      models: [
        {
          id: "model-compatible-report",
          name: "report-model",
          purpose: "报告生成",
          isDefault: false
        }
      ]
    }
  ],
  defaultAiProviderId: "provider-openai",
  defaultAiModelId: "model-gpt-54",
  themeKey: "blue",
  teacherProfile: seedTeacherProfile
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMistakeBook(courses: Course[]): MistakeBookSummary {
  return {
    summary: `多科目错题本 · ${mistakeBookSubjectSummary}`,
    aiPending: 0,
    subjects: K12_MISTAKE_BOOK_SUBJECTS,
    weakPoints: ["待观察"],
    analysis: "暂无错误分析，录入错题后可由 AI 辅助生成。",
    similarQuestions: "暂无类似题型。",
    knowledgeInsight: "暂无知识点分析。"
  };
}

function normalizeMistakeBook(mistakeBook: MistakeBookSummary): MistakeBookSummary {
  return {
    ...mistakeBook,
    summary: `多科目错题本 · ${mistakeBookSubjectSummary}`,
    subjects: K12_MISTAKE_BOOK_SUBJECTS
  };
}

function calculateCourseProgress(currentLesson: number, totalLessons: number) {
  if (totalLessons <= 0) return 0;
  return Math.min(Math.round((currentLesson / totalLessons) * 100), 100);
}

function normalizeCourse(course: Course): Course {
  const totalLessons = Math.max(Number(course.totalLessons) || 1, 1);
  const currentLesson = Math.min(Math.max(Number(course.currentLesson) || 0, 0), totalLessons);
  return {
    subject: course.subject.trim(),
    progress: calculateCourseProgress(currentLesson, totalLessons),
    currentLesson,
    totalLessons
  };
}

function normalizeStudent(student: Student): Student {
  return {
    ...student,
    gender: student.gender === "male" || student.gender === "female" ? student.gender : "female",
    courses: student.courses.map(normalizeCourse),
    mistakeBook: normalizeMistakeBook(student.mistakeBook)
  };
}

function syncMistakeBookSubjects(student: Student) {
  student.mistakeBook.subjects = K12_MISTAKE_BOOK_SUBJECTS;
}

function normalizeClassRecord(record: ClassRecord): ClassRecord {
  return {
    ...record,
    gradingStatus: record.gradingStatus ?? (record.homework.trim() ? "待批改" : "已批改")
  };
}

function normalizeReminder(reminder: ReminderItem): ReminderItem {
  return {
    ...reminder,
    status: reminder.status === "已完成" ? "已完成" : "待提醒"
  };
}

function normalizeScheduledLesson(lesson: ScheduledLesson): ScheduledLesson {
  return {
    ...lesson,
    subject: lesson.subject.trim() || "未分类",
    startsAt: Number(lesson.startsAt) || Date.now(),
    durationMinutes: Math.max(Number(lesson.durationMinutes) || 60, 15),
    topic: lesson.topic.trim(),
    note: lesson.note.trim()
  };
}

function normalizeAiProvider(provider: AiProviderConfig): AiProviderConfig {
  return {
    ...provider,
    name: provider.name.trim() || "未命名供应商",
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey,
    apiFormat: provider.apiFormat ?? "openai-chat",
    connectionStatus: provider.connectionStatus ?? "待测试",
    models: provider.models.map((model) => ({
      ...model,
      name: model.name.trim() || "未命名模型",
      purpose: model.purpose.trim() || "通用",
      isDefault: Boolean(model.isDefault)
    }))
  };
}

function normalizeTeacherProfile(profile?: Partial<TeacherProfile>): TeacherProfile {
  const name = profile?.name?.trim() || seedTeacherProfile.name;
  const title = profile?.title?.trim() || seedTeacherProfile.title;
  const bio = profile?.bio?.trim() || seedTeacherProfile.bio;

  return {
    name,
    title,
    bio
  };
}

function normalizeAppSettings(settings?: AppSettings): AppSettings {
  const source = settings ?? seedAppSettings;
  const aiProviders = clone(source.aiProviders.length ? source.aiProviders : seedAppSettings.aiProviders).map(normalizeAiProvider);
  const firstProvider = aiProviders[0];
  const preferredProvider = aiProviders.find((provider) => provider.id === source.defaultAiProviderId) ?? firstProvider;
  const preferredModel =
    preferredProvider?.models.find((model) => model.id === source.defaultAiModelId) ??
    preferredProvider?.models.find((model) => model.isDefault) ??
    preferredProvider?.models[0];
  const themeKey = appThemes.some((theme) => theme.key === source.themeKey) ? source.themeKey : "blue";

  return {
    aiProviders: aiProviders.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        isDefault: provider.id === preferredProvider?.id && model.id === preferredModel?.id
      }))
    })),
    defaultAiProviderId: preferredProvider?.id ?? "",
    defaultAiModelId: preferredModel?.id ?? "",
    themeKey,
    teacherProfile: normalizeTeacherProfile(source.teacherProfile)
  };
}

function readPersistedState(): PersistedState | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as PersistedState;
    return {
      ...state,
      reminders: state.reminders.map(normalizeReminder),
      scheduledLessons: (state.scheduledLessons ?? seedScheduledLessons).map(normalizeScheduledLesson),
      appSettings: normalizeAppSettings(state.appSettings),
      students: state.students.map(normalizeStudent)
    };
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function writePersistedState(state: PersistedState) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function createPersistedState(
  students: Student[],
  materials: TeachingMaterial[],
  materialSources: MaterialSource[],
  classRecords: ClassRecord[],
  reminders: ReminderItem[],
  scheduledLessons: ScheduledLesson[],
  appSettings: AppSettings
): PersistedState {
  return {
    students,
    materials,
    materialSources,
    classRecords,
    reminders,
    scheduledLessons,
    appSettings
  };
}

export const useStudentStore = defineStore("students", () => {
  const persisted = readPersistedState();
  const items = ref<Student[]>(clone(persisted?.students ?? seedStudents).map(normalizeStudent));
  const materials = ref<TeachingMaterial[]>(clone(persisted?.materials ?? seedMaterials));
  const materialSources = ref<MaterialSource[]>(clone(persisted?.materialSources ?? seedSources));
  const classRecords = ref<ClassRecord[]>(clone(persisted?.classRecords ?? seedRecords).map(normalizeClassRecord));
  const reminders = ref<ReminderItem[]>(clone(persisted?.reminders ?? seedReminders).map(normalizeReminder));
  const scheduledLessons = ref<ScheduledLesson[]>(clone(persisted?.scheduledLessons ?? seedScheduledLessons).map(normalizeScheduledLesson));
  const appSettings = ref<AppSettings>(normalizeAppSettings(persisted?.appSettings));
  const activeStudentId = ref(seedStudents[0].id);
  const isHydrated = ref(false);
  const storageStatus = ref<"local" | "sqlite" | "error">("local");
  const activeStudent = computed(() => {
    return items.value.find((student) => student.id === activeStudentId.value) ?? items.value[0];
  });
  const activeStudentRecords = computed(() => {
    return classRecords.value.filter((record) => record.studentId === activeStudent.value?.id);
  });
  const activeStudentHomework = computed<HomeworkItem[]>(() => {
    return activeStudentRecords.value
      .filter((record) => record.homework.trim())
      .map((record) => ({
        id: record.id,
        studentId: record.studentId,
        subject: record.subject,
        homework: record.homework,
        gradingStatus: record.gradingStatus,
        createdAt: record.createdAt
      }));
  });
  const activeStudentReminders = computed(() => {
    return reminders.value.filter((reminder) => reminder.studentId === activeStudent.value?.id && reminder.status !== "已完成");
  });
  const incompleteReminders = computed(() => reminders.value.filter((reminder) => reminder.status !== "已完成"));
  const completedReminders = computed(() =>
    reminders.value
      .filter((reminder) => reminder.status === "已完成")
      .sort((left, right) => right.remindAt - left.remindAt)
  );
  const sortedReminders = computed(() =>
    incompleteReminders.value
      .slice()
      .sort((left, right) => left.remindAt - right.remindAt)
  );
  const scheduledLessonCalendarItems = computed<ScheduledLessonCalendarItem[]>(() => {
    return scheduledLessons.value
      .map((lesson) => ({
        ...lesson,
        studentName: items.value.find((student) => student.id === lesson.studentId)?.name ?? lesson.studentId,
        endsAt: lesson.startsAt + lesson.durationMinutes * 60 * 1000
      }))
      .sort((left, right) => left.startsAt - right.startsAt);
  });
  const classes = computed(() => groups.value.filter((g) => g.type === "class"));
  const subjectGroups = computed(() => groups.value.filter((g) => g.type === "subject"));
  const ungroupedStudents = computed(() => {
    const groupedIds = new Set(groups.value.flatMap((g) => g.memberIds));
    return items.value.filter((s) => !groupedIds.has(s.id));
  });
  const defaultAiModel = computed<DefaultAiModel | null>(() => {
    const provider = appSettings.value.aiProviders.find((item) => item.id === appSettings.value.defaultAiProviderId);
    const model = provider?.models.find((item) => item.id === appSettings.value.defaultAiModelId);
    if (!provider || !model) return null;
    return {
      ...model,
      providerId: provider.id,
      providerName: provider.name
    };
  });
  const calendarPlanItems = computed<CalendarPlanItem[]>(() => {
    const reminderItems = reminders.value.map((reminder) => ({
      id: reminder.id,
      studentId: reminder.studentId,
      studentName: items.value.find((student) => student.id === reminder.studentId)?.name ?? reminder.studentId,
      title: reminder.title,
      time: reminder.remindAt,
      type: "提醒" as const,
      detail: reminder.relatedType
    }));
    const recordItems = classRecords.value.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: items.value.find((student) => student.id === record.studentId)?.name ?? record.studentId,
      title: `${record.subject} · ${record.lessonContent}`,
      time: new Date(record.createdAt).getTime(),
      type: "课堂记录" as const,
      detail: record.homework ? `作业：${record.homework}` : record.performance
    }));
    return [...reminderItems, ...recordItems].sort((left, right) => right.time - left.time);
  });
  const learningReports = computed<LearningReportSummary[]>(() => {
    return items.value.map((student) => {
      const records = classRecords.value.filter((record) => record.studentId === student.id);
      const homeworkCount = records.filter((record) => record.homework.trim()).length;
      const pendingGradingCount = records.filter((record) => record.homework.trim() && record.gradingStatus === "待批改").length;
      const averageProgress =
        student.courses.length === 0
          ? 0
          : Math.round(student.courses.reduce((total, course) => total + course.progress, 0) / student.courses.length);
      const nextActions = [
        student.mistakeBook.aiPending > 0
          ? `优先处理 ${student.mistakeBook.aiPending} 道待分析错题`
          : "复盘已完成错题并更新薄弱点",
        pendingGradingCount > 0 ? `批改 ${pendingGradingCount} 条待处理作业` : "检查最近课堂作业完成情况",
        averageProgress < 60 ? "安排基础知识点巩固课" : "推进下一阶段课程目标"
      ];

      return {
        studentId: student.id,
        studentName: student.name,
        goal: student.goal,
        style: student.style,
        averageProgress,
        classRecordCount: records.length,
        homeworkCount,
        pendingGradingCount,
        materialCount: materialTitlesForStudent(student.id).length,
        weakPoints: student.mistakeBook.weakPoints,
        nextActions
      };
    });
  });
  const dashboardStats = computed(() => {
    const mistakeCount = items.value.reduce((count, student) => {
      const numbers = student.mistakeBook.summary.match(/\d+/g)?.map(Number) ?? [];
      return count + numbers.reduce((total, current) => total + current, 0);
    }, 0);
    return {
      studentCount: items.value.length,
      mistakeCount,
      todayReminderCount: incompleteReminders.value.length
    };
  });

  function selectStudent(studentId: string) {
    activeStudentId.value = studentId;
  }

  function materialTitlesForStudent(studentId: string) {
    const student = items.value.find((item) => item.id === studentId);
    const profileMaterials = student?.materials ?? [];
    const assignedMaterials = materials.value
      .filter((material) => material.assignedStudentIds.includes(studentId))
      .map((material) => material.title);
    return Array.from(new Set([...profileMaterials, ...assignedMaterials]));
  }

function applyPersistedState(state: PersistedState) {
    items.value = clone(state.students).map(normalizeStudent);
    materials.value = clone(state.materials);
    materialSources.value = clone(state.materialSources);
    classRecords.value = clone(state.classRecords).map(normalizeClassRecord);
    reminders.value = clone(state.reminders);
    scheduledLessons.value = clone(state.scheduledLessons ?? seedScheduledLessons).map(normalizeScheduledLesson);
    appSettings.value = normalizeAppSettings(state.appSettings);
    if (!items.value.some((student) => student.id === activeStudentId.value)) {
      activeStudentId.value = items.value[0]?.id ?? "";
    }
  }

  async function hydrateFromNativeStorage() {
    if (!isTauri()) {
      isHydrated.value = true;
      return;
    }
    try {
      const state = await invoke<PersistedState | null>("load_workspace_state");
      if (state) {
        applyPersistedState(state);
      } else {
        await saveNativeState(currentPersistedState());
      }
      storageStatus.value = "sqlite";
    } catch {
      storageStatus.value = "error";
    } finally {
      isHydrated.value = true;
    }
  }

  function currentPersistedState() {
    return createPersistedState(
      items.value,
      materials.value,
      materialSources.value,
      classRecords.value,
      reminders.value,
      scheduledLessons.value,
      appSettings.value
    );
  }

  async function saveNativeState(state: PersistedState) {
    if (!isTauri()) return;
    try {
      await invoke("save_workspace_state", { state });
      storageStatus.value = "sqlite";
    } catch {
      storageStatus.value = "error";
    }
  }

  async function reloadWorkspace() {
    await hydrateFromNativeStorage();
  }

  function createStudent(draft: StudentDraft) {
  const student: Student = {
      id: createId("student"),
      ...draft,
      gender: draft.gender ?? "female",
      courses: draft.courses.map(normalizeCourse),
      mistakeBook: createMistakeBook(draft.courses)
    };
    items.value.unshift(student);
    activeStudentId.value = student.id;
  }

  function updateStudent(studentId: string, draft: StudentDraft) {
    const index = items.value.findIndex((student) => student.id === studentId);
    if (index === -1) return;
    const existing = items.value[index];
    items.value[index] = {
      ...existing,
      ...draft,
      gender: draft.gender ?? existing.gender,
      courses: draft.courses.map(normalizeCourse),
      mistakeBook: {
        ...existing.mistakeBook,
        subjects: K12_MISTAKE_BOOK_SUBJECTS
      }
    };
  }

  function updateStudentCourse(studentId: string, subject: string, course: Course) {
    const student = items.value.find((item) => item.id === studentId);
    if (!student) return false;
    const courseIndex = student.courses.findIndex((item) => item.subject === subject);
    if (courseIndex === -1) return false;
    student.courses[courseIndex] = normalizeCourse(course);
    syncMistakeBookSubjects(student);
    return true;
  }

  function createStudentCourse(studentId: string, course: Course) {
    const student = items.value.find((item) => item.id === studentId);
    const normalizedCourse = normalizeCourse(course);
    if (!student || !normalizedCourse.subject) return false;
    if (student.courses.some((item) => item.subject === normalizedCourse.subject)) return false;
    student.courses.push(normalizedCourse);
    syncMistakeBookSubjects(student);
    return true;
  }

  function deleteStudentCourse(studentId: string, subject: string) {
    const student = items.value.find((item) => item.id === studentId);
    if (!student || student.courses.length <= 1) return false;
    const beforeCount = student.courses.length;
    student.courses = student.courses.filter((course) => course.subject !== subject);
    if (student.courses.length === beforeCount) return false;
    syncMistakeBookSubjects(student);
    return true;
  }

  function checkInStudentCourse(studentId: string, subject: string) {
    const student = items.value.find((item) => item.id === studentId);
    const course = student?.courses.find((item) => item.subject === subject);
    if (!student || !course || course.currentLesson >= course.totalLessons) return false;
    Object.assign(course, normalizeCourse({ ...course, currentLesson: course.currentLesson + 1 }));
    syncMistakeBookSubjects(student);
    return true;
  }

  function undoStudentCourseCheckIn(studentId: string, subject: string) {
    const student = items.value.find((item) => item.id === studentId);
    const course = student?.courses.find((item) => item.subject === subject);
    if (!student || !course || course.currentLesson <= 0) return false;
    Object.assign(course, normalizeCourse({ ...course, currentLesson: course.currentLesson - 1 }));
    syncMistakeBookSubjects(student);
    return true;
  }

  function deleteStudent(studentId: string) {
    if (items.value.length <= 1) return false;
    items.value = items.value.filter((student) => student.id !== studentId);
    materials.value = materials.value.map((material) => ({
      ...material,
      assignedStudentIds: material.assignedStudentIds.filter((id) => id !== studentId)
    }));
    classRecords.value = classRecords.value.filter((record) => record.studentId !== studentId);
    reminders.value = reminders.value.filter((reminder) => reminder.studentId !== studentId);
    scheduledLessons.value = scheduledLessons.value.filter((lesson) => lesson.studentId !== studentId);
    if (activeStudentId.value === studentId) {
      activeStudentId.value = items.value[0]?.id ?? "";
    }
    return true;
  }

  function updateMistakeAnalysis(studentId: string, patch: MistakeBookPatch) {
    const student = items.value.find((item) => item.id === studentId);
    if (!student) return;
    student.mistakeBook = {
      ...student.mistakeBook,
      ...patch
    };
  }

  function createMaterial(material: Omit<TeachingMaterial, "id" | "syncStatus">) {
    materials.value.unshift({
      ...material,
      id: createId("material"),
      syncStatus: "待同步"
    });
  }

  function updateMaterial(materialId: string, patch: Omit<TeachingMaterial, "id" | "syncStatus">) {
    const index = materials.value.findIndex((material) => material.id === materialId);
    if (index === -1) return false;
    materials.value[index] = {
      ...materials.value[index],
      ...patch,
      syncStatus: "待同步"
    };
    return true;
  }

  function deleteMaterial(materialId: string) {
    const beforeCount = materials.value.length;
    materials.value = materials.value.filter((material) => material.id !== materialId);
    return materials.value.length < beforeCount;
  }

  function importScannedMaterials(scannedMaterials: ScannedMaterial[], sourceType: MaterialSourceProtocol) {
    const existingPaths = new Set(materials.value.map((material) => material.sourcePath));
    const imported = scannedMaterials.filter((material) => !existingPaths.has(material.sourcePath));

    materials.value.unshift(
      ...imported.map((material) => ({
        id: createId("material"),
        title: material.title,
        category: material.fileType.toUpperCase(),
        tags: [material.fileType],
        assignedStudentIds: [],
        sourceType,
        sourcePath: material.sourcePath,
        syncStatus: "已索引" as const
      }))
    );

    return imported.length;
  }

  function createMaterialSource(source: Omit<MaterialSource, "id" | "connectionStatus">) {
    materialSources.value.unshift({
      ...source,
      id: createId("source"),
      connectionStatus: "待测试"
    });
  }

  function testMaterialSource(sourceId: string) {
    const source = materialSources.value.find((item) => item.id === sourceId);
    if (!source) return false;
    const hasConnectionTarget = source.protocol === "local" ? source.path.trim() : source.host.trim();
    source.connectionStatus = hasConnectionTarget ? "可用" : "异常";
    return source.connectionStatus === "可用";
  }

  function deleteMaterialSource(sourceId: string) {
    const beforeCount = materialSources.value.length;
    materialSources.value = materialSources.value.filter((source) => source.id !== sourceId);
    return materialSources.value.length < beforeCount;
  }

  function createClassRecord(record: Omit<ClassRecord, "id" | "createdAt" | "gradingStatus">) {
    classRecords.value.unshift({
      ...record,
      gradingStatus: record.homework.trim() ? "待批改" : "已批改",
      id: createId("record"),
      createdAt: new Date().toISOString()
    });
  }

  function updateClassRecord(recordId: string, patch: Omit<ClassRecord, "id" | "createdAt" | "gradingStatus">) {
    const index = classRecords.value.findIndex((record) => record.id === recordId);
    if (index === -1) return false;
    const previous = classRecords.value[index];
    const nextHomework = patch.homework.trim();
    const gradingStatus = !nextHomework ? "已批改" : nextHomework !== previous.homework.trim() ? "待批改" : previous.gradingStatus;
    classRecords.value[index] = {
      ...previous,
      ...patch,
      gradingStatus
    };
    return true;
  }

  function updateHomeworkGradingStatus(recordId: string, status: GradingStatus) {
    const record = classRecords.value.find((item) => item.id === recordId);
    if (!record || !record.homework.trim()) return false;
    record.gradingStatus = status;
    return true;
  }

  function createReminder(reminder: Omit<ReminderItem, "id" | "status">) {
    reminders.value.unshift({
      ...reminder,
      id: createId("reminder"),
      status: "待提醒"
    });
  }

  function createCourseReminder(studentId: string, subject: string, remindAt: number) {
    const student = items.value.find((item) => item.id === studentId);
    const course = student?.courses.find((item) => item.subject === subject);
    if (!student || !course || !remindAt) return false;
    const lessonNumber = Math.min(course.currentLesson + 1, course.totalLessons);
    createReminder({
      studentId,
      title: `${student.name}${course.subject}第 ${lessonNumber} 节课`,
      remindAt,
      relatedType: "课程"
    });
    return true;
  }

  function deleteReminder(reminderId: string) {
    const beforeCount = reminders.value.length;
    reminders.value = reminders.value.filter((reminder) => reminder.id !== reminderId);
    return reminders.value.length < beforeCount;
  }

  function completeReminder(reminderId: string) {
    const reminder = reminders.value.find((item) => item.id === reminderId);
    if (!reminder || reminder.status === "已完成") return false;
    reminder.status = "已完成";
    return true;
  }

  function undoCompleteReminder(reminderId: string) {
    const reminder = reminders.value.find((item) => item.id === reminderId);
    if (!reminder || reminder.status !== "已完成") return false;
    reminder.status = "待提醒";
    return true;
  }

  function createScheduledLesson(lesson: ScheduledLessonDraft) {
    scheduledLessons.value.unshift(
      normalizeScheduledLesson({
        ...lesson,
        id: createId("lesson")
      })
    );
  }

  function updateScheduledLesson(lessonId: string, patch: ScheduledLessonDraft) {
    const index = scheduledLessons.value.findIndex((lesson) => lesson.id === lessonId);
    if (index === -1) return false;
    scheduledLessons.value[index] = normalizeScheduledLesson({
      ...patch,
      id: lessonId
    });
    return true;
  }

  function deleteScheduledLesson(lessonId: string) {
    const beforeCount = scheduledLessons.value.length;
    scheduledLessons.value = scheduledLessons.value.filter((lesson) => lesson.id !== lessonId);
    return scheduledLessons.value.length < beforeCount;
  }

  function markDefaultAiModel(providerId: string, modelId: string, providers: AiProviderConfig[]) {
    return providers.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        isDefault: provider.id === providerId && model.id === modelId
      }))
    }));
  }

  function createAiProvider(provider: AiProviderDraft) {
    const normalized = normalizeAiProvider({
      ...provider,
      id: createId("provider"),
      models: provider.models.map((model) => ({
        ...model,
        id: model.id || createId("model")
      }))
    });
    const defaultModel = normalized.models.find((model) => model.isDefault) ?? normalized.models[0];
    appSettings.value.aiProviders.unshift(normalized);
    if (defaultModel) {
      appSettings.value.defaultAiProviderId = normalized.id;
      appSettings.value.defaultAiModelId = defaultModel.id;
      appSettings.value.aiProviders = markDefaultAiModel(normalized.id, defaultModel.id, appSettings.value.aiProviders);
    }
  }

  function updateAiProvider(providerId: string, patch: AiProviderDraft) {
    const index = appSettings.value.aiProviders.findIndex((provider) => provider.id === providerId);
    if (index === -1) return false;
    const normalized = normalizeAiProvider({
      ...patch,
      id: providerId,
      models: patch.models.map((model) => ({
        ...model,
        id: model.id || createId("model")
      }))
    });
    appSettings.value.aiProviders[index] = normalized;
    const defaultModel = normalized.models.find((model) => model.isDefault) ?? normalized.models[0];
    if (defaultModel && appSettings.value.defaultAiProviderId === providerId) {
      appSettings.value.defaultAiModelId = defaultModel.id;
      appSettings.value.aiProviders = markDefaultAiModel(providerId, defaultModel.id, appSettings.value.aiProviders);
    }
    appSettings.value = normalizeAppSettings(appSettings.value);
    return true;
  }

  function deleteAiProvider(providerId: string) {
    const beforeCount = appSettings.value.aiProviders.length;
    appSettings.value.aiProviders = appSettings.value.aiProviders.filter((provider) => provider.id !== providerId);
    if (appSettings.value.aiProviders.length === beforeCount) return false;
    appSettings.value = normalizeAppSettings(appSettings.value);
    return true;
  }

  function setDefaultAiModel(providerId: string, modelId: string) {
    const provider = appSettings.value.aiProviders.find((item) => item.id === providerId);
    if (!provider?.models.some((model) => model.id === modelId)) return false;
    appSettings.value.defaultAiProviderId = providerId;
    appSettings.value.defaultAiModelId = modelId;
    appSettings.value.aiProviders = markDefaultAiModel(providerId, modelId, appSettings.value.aiProviders);
    return true;
  }

  function setAppTheme(themeKey: string) {
    if (!appThemes.some((theme) => theme.key === themeKey)) return false;
    appSettings.value.themeKey = themeKey as AppThemeKey;
    return true;
  }

  function updateTeacherProfile(profile: Partial<TeacherProfile>) {
    if (profile.name !== undefined && !profile.name.trim()) return false;
    appSettings.value.teacherProfile = normalizeTeacherProfile({
      ...appSettings.value.teacherProfile,
      ...profile
    });
    return true;
  }

  watch(
    [items, materials, materialSources, classRecords, reminders, scheduledLessons, appSettings],
    () => {
      const state = currentPersistedState();
      writePersistedState(state);
      void saveNativeState(state);
    },
    { deep: true }
  );

  void hydrateFromNativeStorage();

  return {
    items,
    materials,
    materialSources,
    classRecords,
    reminders,
    scheduledLessons,
    appSettings,
    activeStudent,
    activeStudentId,
    activeStudentRecords,
    activeStudentHomework,
    activeStudentReminders,
    incompleteReminders,
    completedReminders,
    sortedReminders,
    scheduledLessonCalendarItems,
    defaultAiModel,
    calendarPlanItems,
    learningReports,
    dashboardStats,
    isHydrated,
    storageStatus,
    selectStudent,
    materialTitlesForStudent,
    createStudent,
    updateStudent,
    updateStudentCourse,
    createStudentCourse,
    deleteStudentCourse,
    checkInStudentCourse,
    undoStudentCourseCheckIn,
    deleteStudent,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    importScannedMaterials,
    createMaterialSource,
    testMaterialSource,
    deleteMaterialSource,
    createClassRecord,
    updateClassRecord,
    updateHomeworkGradingStatus,
    createReminder,
    createCourseReminder,
    deleteReminder,
    completeReminder,
    undoCompleteReminder,
    createScheduledLesson,
    updateScheduledLesson,
    deleteScheduledLesson,
    createAiProvider,
    updateAiProvider,
    deleteAiProvider,
    setDefaultAiModel,
    setAppTheme,
    updateTeacherProfile,
    reloadWorkspace,
    updateMistakeAnalysis,
    applyPersistedState,
    groups,
    classes,
    subjectGroups,
    ungroupedStudents,
    studentGroupsFor,
    createGroup,
    updateGroup,
    deleteGroup,
    addStudentToGroup,
    removeStudentFromGroup,
    moveStudentToGroup
  };
});
