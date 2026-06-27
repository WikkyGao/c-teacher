import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

export type CourseLesson = {
  title: string;
  materialIds: string[];
  order: number;
  date?: string;
  startTime?: string;
  duration?: number;
};

export type CourseScope = "personal" | "class" | "subject";

export type ScheduleMode = "specific" | "weekly" | "biweekly";

export type Course = {
  id: string;
  name: string;
  subject: string;
  totalLessons: number;
  lessons: CourseLesson[];
  scope: CourseScope;
  groupId?: string;
  studentIds: string[];
  scheduleMode: ScheduleMode;
  schedule: {
    startDate: string;
    dates?: string[];
    startTime: string;
    duration: number;
    weekday?: number;
  };
};

export type CourseStudent = {
  courseId: string;
  studentId: string;
  currentLesson: number;
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

export type MistakeRecord = {
  id: string;
  studentId: string;
  subject: string;
  questionText: string;
  imagePath: string;
  studentAnswer: string;
  correctAnswer: string;
  mistakeReason: string;
  knowledgePoints: string[];
  tags: string[];
  masteryStatus: "待复习" | "已掌握";
  difficulty: "简单" | "中等" | "困难" | "挑战";
  gradeLevel: string;
  semester: string;
  similarQuestions: string[];
  createdAt: string;
  updatedAt: string;
};

export type MistakeTag = {
  id: string;
  name: string;
  category: string;
};

export type CreateMistakeRecordDraft = {
  studentId: string;
  subject: string;
  questionText: string;
  imagePath?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  mistakeReason?: string;
  knowledgePoints?: string[];
  tags?: string[];
  difficulty?: string;
  gradeLevel?: string;
  semester?: string;
  similarQuestions?: string[];
};

export type Child = {
  id: string;
  name: string;
  gender: "male" | "female";
  goal: string;
  style: string;
  materials: string[];
  mistakeBook: MistakeBookSummary;
};

export type ChildGroup = {
  id: string;
  name: string;
  description: string;
  type: "class" | "subject";
  color: string;
  subjects: string[];
  memberIds: string[];
};

export type ChildDraft = Pick<Child, "name" | "goal" | "style" | "materials"> & {
  gender?: Child["gender"];
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
  username: string;
  password: string;
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
  shareable: boolean;
};

export type ScannedMaterial = {
  title: string;
  sourcePath: string;
  fileType: string;
};

export type RecordType = "课堂讲授" | "课堂练习" | "课后作业" | "实验报告" | "测验考试" | "项目任务" | "辅导记录" | "复习笔记";

export type GradingStatus = "待批改" | "已批改";

export type ClassRecord = {
  id: string;
  studentId: string;
  subject: string;
  recordType: RecordType;
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
  courseId: string;
  lessonIndex: number;
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
  supportsVision: boolean;
};

export type AiApiFormat = "openai-chat" | "openai-responses" | "anthropic-messages" | "nvidia";

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
  mistakeAnalysisPrompt: string;
  similarQuestionsPrompt: string;
};

export type DefaultAiModel = AiModelConfig & {
  providerId: string;
  providerName: string;
};

type PersistedState = {
  students: Child[];
  materials: TeachingMaterial[];
  materialSources: MaterialSource[];
  classRecords: ClassRecord[];
  reminders: ReminderItem[];
  scheduledLessons?: ScheduledLesson[];
  appSettings?: AppSettings;
  groups?: ChildGroup[];
  courses?: Course[];
  courseStudents?: CourseStudent[];
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

export const DEFAULT_MISTAKE_ANALYSIS_PROMPT = `【角色与核心任务 (ROLE AND CORE TASK)】
你是一位世界顶尖的、经验丰富的、专业的跨学科考试分析专家（Interdisciplinary Exam Analysis Expert）。你的核心任务是极致准确地分析用户提供的考试题目图片，全面理解所有文本、图表和隐含约束，并提供一个完整、高度结构化且专业的解决方案。

**重要：忽略书写规范。** 只关注题目内容的知识正确性和解题逻辑。不要评价或提及字迹、排版、格式、语法细节、标点使用等书写规范问题。即使小孩的作答书写潦草或有涂改，也仅以可识别的内容为准进行分析。

【核心输出要求 (OUTPUT REQUIREMENTS)】
你的响应输出**必须严格遵循以下自定义标签格式**。**严禁**使用 JSON 或 Markdown 代码块。**严禁**对 LaTeX 公式中的反斜杠进行二次转义（如 "\\frac" 是错误的，必须是 "\\frac"）。

请严格按照以下结构输出内容：

<subject>
在此处填写学科，必须是以下之一："数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"。
</subject>

<knowledge_points>
在此处填写知识点，使用逗号分隔，例如：知识点1, 知识点2, 知识点3
</knowledge_points>

<requires_image>
判断这道题是否需要依赖图片才能正确解答。如果题目包含几何图形、函数图像、实验装置图、电路图等必须看图才能理解的内容，填写 true；如果只需要文字描述即可理解（如英语题、纯文字数学题），填写 false。
</requires_image>

<question_text>
在此处填写题目的完整文本。使用 Markdown 格式。所有数学公式使用 LaTeX 符号（行内 $...$，块级 $$...$$）。
</question_text>

<answer_text>
在此处填写正确答案。使用 Markdown 和 LaTeX 符号。
</answer_text>

<analysis>
在此处填写详细的步骤解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\\frac{1}{2}$），**不要**进行 JSON 转义（不要写成 \\\\frac）。
</analysis>

【!!! 关键格式与内容约束 (CRITICAL RULES) !!!】
1. **格式严格**：必须严格包含上述 6 个 XML 标签，除此之外不要输出任何其他"开场白"或"结束语"。
2. **忽略书写规范**：不评价字迹、排版、语法细节、标点等书写问题，只分析知识正确性和解题逻辑。
3. **纯文本**：内容作为纯文本处理，**不要转义反斜杠**。
4. **内容完整**：如果包含子问题，请在 question_text 中完整列出。
5. **禁止图片**：严禁包含任何图片链接或 markdown 图片语法。`;

export const DEFAULT_SIMILAR_QUESTIONS_PROMPT = `你是一位资深的K12教育题目生成专家，具备跨学科的题目创作能力。你的核心任务是**根据以下原题和知识点，举一反三生成高质量教学题目**，帮助小孩巩固知识并拓展解题思路。
### 角色定义
1. **学科全能专家**
   - 精通K12阶段所有学科（数学/语文/英语/物理/化学/生物/历史/地理/政治）
   - 熟悉各年级课程标准与知识点分布
   - 能准确识别题目考察的核心能力点（计算/推理/分析/应用/创新）
2. **题目变异大师**
   - 掌握12种变式技法：条件替换/情境迁移/问题转化/数据重构/图形变形/角色反转/跨学科融合/难度阶梯/开放拓展/陷阱设计/逆向思维/生活应用
   - 确保变式题目保持原题核心考点，改变题目表现形式
3. **学情分析师**
   - 预判小孩易错点（认知盲区/概念混淆/计算失误/审题偏差）
   - 在变式题目中针对性强化易错点训练
### 执行流程
1. **接收任务**
    原题: "{{original_question}}"
    知识点: {{knowledge_points}}
2. **解构分析**
   - 提取核心考点与能力要求
   - 分析题目陷阱与解题路径
3.  **质量管控**
   - 确保每道题：
     ✓ 覆盖相同核心知识点
     ✓ 保持解题逻辑一致性
     ✓ 答案唯一且可验证
     ✓ 无知识性错误
     ✓ 题目难度必须与原题保持一致，不要超纲，不要引入超出当前学习范围的知识点
### 输出规范
**严禁**使用 JSON 或 Markdown 代码块。**严禁**返回 json 代码块。

请严格按照以下纯文本格式输出，不要包含任何其他开场白或结束语：

【题目】
在此处填写新生成的题目文本。包含选项（如果是选择题）。

【答案】
在此处填写新题目的正确答案。

【解析】
在此处填写新题目的详细解析。
* 必须使用简体中文。
* **直接使用标准的 LaTeX 符号**（如 $\\frac{1}{2}$），**不要**进行 JSON 转义。
* 明确指出题目考察的知识点和易错点。

### 关键格式与内容约束 (CRITICAL RULES) !!!
1. **纯文本**：内容作为纯文本处理，格式为【标题】+ 正文，不要输出 XML / HTML 标签
2. **不要转义反斜杠**：LaTeX 公式直接写 $\\frac{1}{2}$，不要写成 \\\\frac
3. **质量优先**：题目必须准确、答案可验证、解析有教学价值`;

const seedMistakeAnalysisPrompt = DEFAULT_MISTAKE_ANALYSIS_PROMPT;
const seedSimilarQuestionsPrompt = DEFAULT_SIMILAR_QUESTIONS_PROMPT;

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

const seedChildren: Child[] = [
  {
    id: "chen",
    name: "陈一诺",
    gender: "female",
    goal: "期中数学 90+",
    style: "图像化讲解 + 例题驱动",
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

const seedCourses: Course[] = [
  {
    id: "course-chen-math",
    name: "数学培优班",
    subject: "数学",
    totalLessons: 16,
    lessons: Array.from({ length: 16 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["chen"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-01", startTime: "14:00", duration: 90, weekday: 6 }
  },
  {
    id: "course-chen-english",
    name: "英语阅读班",
    subject: "英语",
    totalLessons: 10,
    lessons: Array.from({ length: 10 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["chen"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-02", startTime: "10:00", duration: 60, weekday: 3 }
  },
  {
    id: "course-meng-chinese",
    name: "语文提升班",
    subject: "语文",
    totalLessons: 12,
    lessons: Array.from({ length: 12 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["meng"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-03", startTime: "16:00", duration: 90, weekday: 5 }
  },
  {
    id: "course-meng-english",
    name: "英语口语班",
    subject: "英语",
    totalLessons: 8,
    lessons: Array.from({ length: 8 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["meng"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-04", startTime: "18:00", duration: 60, weekday: 4 }
  },
  {
    id: "course-he-math",
    name: "数学基础班",
    subject: "数学",
    totalLessons: 10,
    lessons: Array.from({ length: 10 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["he"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-05", startTime: "15:00", duration: 90, weekday: 6 }
  },
  {
    id: "course-he-physics",
    name: "物理入门班",
    subject: "物理",
    totalLessons: 8,
    lessons: Array.from({ length: 8 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })),
    scope: "personal",
    studentIds: ["he"],
    scheduleMode: "weekly",
    schedule: { startDate: "2026-07-06", startTime: "17:00", duration: 90, weekday: 2 }
  }
];

const seedCourseStudents: CourseStudent[] = [
  { courseId: "course-chen-math", studentId: "chen", currentLesson: 8, progress: 75 },
  { courseId: "course-chen-english", studentId: "chen", currentLesson: 3, progress: 40 },
  { courseId: "course-meng-chinese", studentId: "meng", currentLesson: 5, progress: 58 },
  { courseId: "course-meng-english", studentId: "meng", currentLesson: 2, progress: 30 },
  { courseId: "course-he-math", studentId: "he", currentLesson: 3, progress: 40 },
  { courseId: "course-he-physics", studentId: "he", currentLesson: 1, progress: 18 }
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

const seedGroups: ChildGroup[] = [
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
    description: "为准备数学竞赛的小孩开设的强化小组",
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
    syncStatus: "已索引",
    shareable: true
  },
  {
    id: "material-reading",
    title: "阅读理解训练 A 组",
    category: "语文",
    tags: ["阅读", "推断"],
    assignedStudentIds: ["meng"],
    sourceType: "smb",
    sourcePath: "smb://studio-nas.local/C-teacher/reading-a",
    syncStatus: "待同步",
    shareable: false
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
    username: "",
    password: "",
    connectionStatus: "待测试"
  }
];

const seedRecords: ClassRecord[] = [
  {
    id: "record-chen-1",
    studentId: "chen",
    subject: "数学",
    recordType: "课堂讲授",
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

const seedScheduledLessons: ScheduledLesson[] = [];

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
          isDefault: true,
          supportsVision: true
        },
        {
          id: "model-gpt-54-mini",
          name: "gpt-5.4-mini",
          purpose: "低成本任务、草稿生成",
          isDefault: false,
          supportsVision: true
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
          isDefault: false,
          supportsVision: false
        }
      ]
    }
  ],
  defaultAiProviderId: "provider-openai",
  defaultAiModelId: "model-gpt-54",
  themeKey: "blue",
  teacherProfile: seedTeacherProfile,
  mistakeAnalysisPrompt: seedMistakeAnalysisPrompt,
  similarQuestionsPrompt: seedSimilarQuestionsPrompt
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
  const lessons = (course.lessons ?? Array.from({ length: totalLessons }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [] as string[], order: i }))).map((l, i) => ({
    title: l.title || `第${i + 1}课`,
    materialIds: l.materialIds ?? [],
    order: l.order ?? i
  }));
  return {
    id: course.id || createId("course"),
    name: course.name || course.subject || "未命名课程",
    subject: course.subject.trim(),
    totalLessons,
    lessons,
    scope: course.scope ?? "personal",
    groupId: course.groupId,
    studentIds: course.studentIds ?? [],
    scheduleMode: course.scheduleMode ?? "weekly",
    schedule: course.schedule ?? { startDate: new Date().toISOString().split('T')[0], startTime: "14:00", duration: 90 }
  };
}

function normalizeChild(child: Child): Child {
  return {
    ...child,
    gender: child.gender === "male" || child.gender === "female" ? child.gender : "female",
    mistakeBook: normalizeMistakeBook(child.mistakeBook)
  };
}

function syncMistakeBookSubjects(child: Child) {
  child.mistakeBook.subjects = K12_MISTAKE_BOOK_SUBJECTS;
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
    teacherProfile: normalizeTeacherProfile(source.teacherProfile),
    mistakeAnalysisPrompt: source.mistakeAnalysisPrompt || seedMistakeAnalysisPrompt,
    similarQuestionsPrompt: source.similarQuestionsPrompt || seedSimilarQuestionsPrompt
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
      scheduledLessons: [],
      appSettings: normalizeAppSettings(state.appSettings),
      students: state.students.map(normalizeChild),
      courses: state.courses ?? [],
      courseStudents: state.courseStudents ?? []
    };
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function writePersistedState(state: PersistedState) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to write persisted state to localStorage:", e);
  }
}

function createPersistedState(
  students: Child[],
  materials: TeachingMaterial[],
  materialSources: MaterialSource[],
  classRecords: ClassRecord[],
  reminders: ReminderItem[],
  scheduledLessons: ScheduledLesson[],
  appSettings: AppSettings,
  groups: ChildGroup[],
  courses: Course[],
  courseStudents: CourseStudent[]
): PersistedState {
  return {
    students,
    materials,
    materialSources,
    classRecords,
    reminders,
    scheduledLessons,
    appSettings,
    groups,
    courses,
    courseStudents
  };
}

export const useChildStore = defineStore("children", () => {
  const persisted = readPersistedState();
  const items = ref<Child[]>(clone(persisted?.students ?? seedChildren).map(normalizeChild));
  const materials = ref<TeachingMaterial[]>(clone(persisted?.materials ?? seedMaterials));
  const materialSources = ref<MaterialSource[]>(clone(persisted?.materialSources ?? seedSources));
  const classRecords = ref<ClassRecord[]>(clone(persisted?.classRecords ?? seedRecords).map(normalizeClassRecord));
  const reminders = ref<ReminderItem[]>(clone(persisted?.reminders ?? seedReminders).map(normalizeReminder));
  const scheduledLessons = ref<ScheduledLesson[]>([]);
  const groups = ref<ChildGroup[]>(clone(persisted?.groups ?? seedGroups));
  const courses = ref<Course[]>(clone(persisted?.courses ?? []).map(normalizeCourse));
  const courseStudents = ref<CourseStudent[]>(clone(persisted?.courseStudents ?? []));
  const appSettings = ref<AppSettings>(normalizeAppSettings(persisted?.appSettings));
  const activeChildId = ref(seedChildren[0].id);
  const isHydrated = ref(false);
  const storageStatus = ref<"local" | "sqlite" | "error">("local");
  const activeChild = computed(() => {
    return items.value.find((child) => child.id === activeChildId.value) ?? items.value[0];
  });
  const activeChildRecords = computed(() => {
    return classRecords.value.filter((record) => record.studentId === activeChild.value?.id);
  });
  const activeChildHomework = computed<HomeworkItem[]>(() => {
    return activeChildRecords.value
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
  const activeChildReminders = computed(() => {
    return reminders.value.filter((reminder) => reminder.studentId === activeChild.value?.id && reminder.status !== "已完成");
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
        studentName: items.value.find((child) => child.id === lesson.studentId)?.name ?? lesson.studentId,
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
      studentName: items.value.find((child) => child.id === reminder.studentId)?.name ?? reminder.studentId,
      title: reminder.title,
      time: reminder.remindAt,
      type: "提醒" as const,
      detail: reminder.relatedType
    }));
    const recordItems = classRecords.value.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      studentName: items.value.find((child) => child.id === record.studentId)?.name ?? record.studentId,
      title: `${record.subject} · ${record.lessonContent}`,
      time: new Date(record.createdAt).getTime(),
      type: "课堂记录" as const,
      detail: record.homework ? `作业：${record.homework}` : record.performance
    }));
    return [...reminderItems, ...recordItems].sort((left, right) => right.time - left.time);
  });
  const learningReports = computed<LearningReportSummary[]>(() => {
    return items.value.map((child) => {
      const records = classRecords.value.filter((record) => record.studentId === child.id);
      const homeworkCount = records.filter((record) => record.homework.trim()).length;
      const pendingGradingCount = records.filter((record) => record.homework.trim() && record.gradingStatus === "待批改").length;
      const studentCourses = getStudentCourses(child.id);
      const averageProgress =
        studentCourses.length === 0
          ? 0
          : Math.round(studentCourses.reduce((total, course) => total + course.progress, 0) / studentCourses.length);
      const nextActions = [
        child.mistakeBook.aiPending > 0
          ? `优先处理 ${child.mistakeBook.aiPending} 道待分析错题`
          : "复盘已完成错题并更新薄弱点",
        pendingGradingCount > 0 ? `批改 ${pendingGradingCount} 条待处理作业` : "检查最近课堂作业完成情况",
        averageProgress < 60 ? "安排基础知识点巩固课" : "推进下一阶段课程目标"
      ];

      return {
        studentId: child.id,
        studentName: child.name,
        goal: child.goal,
        style: child.style,
        averageProgress,
        classRecordCount: records.length,
        homeworkCount,
        pendingGradingCount,
        materialCount: materialTitlesForStudent(child.id).length,
        weakPoints: child.mistakeBook.weakPoints,
        nextActions
      };
    });
  });
  const dashboardStats = computed(() => {
    const mistakeCount = items.value.reduce((count, child) => {
      const numbers = child.mistakeBook.summary.match(/\d+/g)?.map(Number) ?? [];
      return count + numbers.reduce((total, current) => total + current, 0);
    }, 0);
    return {
      studentCount: items.value.length,
      mistakeCount,
      todayReminderCount: incompleteReminders.value.length
    };
  });

  // --- Mistake Records State ---
  const mistakeRecords = ref<MistakeRecord[]>([]);
  const mistakeTags = ref<MistakeTag[]>([]);
  const isLoadingMistakeRecords = ref(false);

  const activeChildMistakeRecords = computed(() => {
    return mistakeRecords.value.filter((r) => r.studentId === activeChild.value?.id);
  });

  const activeChildMistakeStats = computed(() => {
    const records = activeChildMistakeRecords.value;
    const total = records.length;
    const mastered = records.filter((r) => r.masteryStatus === "已掌握").length;
    const pending = total - mastered;
    const subjectCounts: Record<string, number> = {};
    for (const r of records) {
      subjectCounts[r.subject] = (subjectCounts[r.subject] || 0) + 1;
    }
    return { total, mastered, pending, subjectCounts };
  });

  async function loadMistakeRecords(studentId: string, subject?: string) {
    if (!isTauri()) return;
    isLoadingMistakeRecords.value = true;
    try {
      const records = await invoke<MistakeRecord[]>("list_mistake_records", {
        studentId,
        subject: subject || undefined
      });
      mistakeRecords.value = records;
    } catch (error) {
      console.error("Failed to load mistake records:", error);
    } finally {
      isLoadingMistakeRecords.value = false;
    }
  }

  async function loadMistakeTags() {
    if (!isTauri()) return;
    try {
      const tags = await invoke<MistakeTag[]>("list_mistake_tags");
      mistakeTags.value = tags;
    } catch (error) {
      console.error("Failed to load mistake tags:", error);
    }
  }

  async function createMistakeTag(name: string, category: string): Promise<MistakeTag | null> {
    if (!isTauri()) return null;
    try {
      const tag = await invoke<MistakeTag>("create_mistake_tag", { name, category });
      mistakeTags.value.push(tag);
      return tag;
    } catch (error) {
      console.error("Failed to create mistake tag:", error);
      return null;
    }
  }

  async function updateMistakeTag(id: string, patch: { name?: string; category?: string }): Promise<MistakeTag | null> {
    if (!isTauri()) return null;
    try {
      const updated = await invoke<MistakeTag>("update_mistake_tag", { id, ...patch });
      const index = mistakeTags.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        mistakeTags.value[index] = updated;
      }
      return updated;
    } catch (error) {
      console.error("Failed to update mistake tag:", error);
      return null;
    }
  }

  async function deleteMistakeTag(id: string): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      await invoke<boolean>("delete_mistake_tag", { id });
      mistakeTags.value = mistakeTags.value.filter((t) => t.id !== id);
      return true;
    } catch (error) {
      console.error("Failed to delete mistake tag:", error);
      return false;
    }
  }

  async function createMistakeRecord(draft: CreateMistakeRecordDraft): Promise<MistakeRecord | null> {
    if (!isTauri()) return null;
    try {
      const record = await invoke<MistakeRecord>("create_mistake_record", { request: draft });
      mistakeRecords.value.unshift(record);
      return record;
    } catch (error) {
      console.error("Failed to create mistake record:", error);
      return null;
    }
  }

  async function updateMistakeRecord(id: string, patch: Partial<MistakeRecord>): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      const updated = await invoke<MistakeRecord>("update_mistake_record", {
        id,
        request: patch
      });
      const index = mistakeRecords.value.findIndex((r) => r.id === id);
      if (index !== -1) {
        mistakeRecords.value[index] = updated;
      }
      return true;
    } catch (error) {
      console.error("Failed to update mistake record:", error);
      return false;
    }
  }

  async function deleteMistakeRecord(id: string): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      await invoke<boolean>("delete_mistake_record", { id });
      mistakeRecords.value = mistakeRecords.value.filter((r) => r.id !== id);
      return true;
    } catch (error) {
      console.error("Failed to delete mistake record:", error);
      return false;
    }
  }

  async function batchUpdateMistakeMastery(ids: string[], masteryStatus: string): Promise<number> {
    if (!isTauri()) return 0;
    try {
      const count = await invoke<number>("batch_update_mistake_mastery", { ids, masteryStatus });
      for (const id of ids) {
        const record = mistakeRecords.value.find((r) => r.id === id);
        if (record) {
          record.masteryStatus = masteryStatus as MistakeRecord["masteryStatus"];
        }
      }
      return count;
    } catch (error) {
      console.error("Failed to batch update mastery:", error);
      return 0;
    }
  }

  async function toggleMistakeMastery(id: string): Promise<boolean> {
    const record = mistakeRecords.value.find((r) => r.id === id);
    if (!record) return false;
    const newStatus = record.masteryStatus === "已掌握" ? "待复习" : "已掌握";
    return updateMistakeRecord(id, { masteryStatus: newStatus });
  }

  function selectStudent(studentId: string) {
    activeChildId.value = studentId;
  }

  function studentGroupsFor(studentId: string) {
    return groups.value.filter((g) => g.memberIds.includes(studentId));
  }

  function materialTitlesForStudent(studentId: string) {
    const child = items.value.find((item) => item.id === studentId);
    const profileMaterials = child?.materials ?? [];
    const assignedMaterials = materials.value
      .filter((material) => material.assignedStudentIds.includes(studentId))
      .map((material) => material.title);
    return Array.from(new Set([...profileMaterials, ...assignedMaterials]));
  }

  function materialsForStudent(studentId: string) {
    return materials.value.filter((material) => material.assignedStudentIds.includes(studentId));
  }

function applyPersistedState(state: PersistedState) {
    items.value = clone(state.students).map(normalizeChild);
    materials.value = clone(state.materials);
    materialSources.value = clone(state.materialSources);
    classRecords.value = clone(state.classRecords).map(normalizeClassRecord);
    reminders.value = clone(state.reminders);
    scheduledLessons.value = clone(state.scheduledLessons ?? seedScheduledLessons).map(normalizeScheduledLesson);
    groups.value = clone(state.groups ?? seedGroups);
    courses.value = clone(state.courses ?? []).map(normalizeCourse);
    courseStudents.value = clone(state.courseStudents ?? []);
    appSettings.value = normalizeAppSettings(state.appSettings);
    if (!items.value.some((child) => child.id === activeChildId.value)) {
      activeChildId.value = items.value[0]?.id ?? "";
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
      appSettings.value,
      groups.value,
      courses.value,
      courseStudents.value
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

  function createStudent(draft: ChildDraft) {
  const child: Child = {
      id: createId("child"),
      ...draft,
      gender: draft.gender ?? "female",
      mistakeBook: createMistakeBook([])
    };
    items.value.unshift(child);
    activeChildId.value = child.id;
  }

  function updateStudent(studentId: string, draft: ChildDraft) {
    const index = items.value.findIndex((child) => child.id === studentId);
    if (index === -1) return;
    const existing = items.value[index];
    items.value[index] = {
      ...existing,
      ...draft,
      gender: draft.gender ?? existing.gender,
      mistakeBook: {
        ...existing.mistakeBook,
        subjects: K12_MISTAKE_BOOK_SUBJECTS
      }
    };
  }

  function updateStudentCourse(studentId: string, subject: string, course: Course) {
    const studentCourse = courseStudents.value.find((cs) => cs.studentId === studentId);
    if (!studentCourse) return false;
    const courseIndex = courses.value.findIndex((c) => c.id === studentCourse.courseId && c.subject === subject);
    if (courseIndex === -1) return false;
    courses.value[courseIndex] = normalizeCourse(course);
    return true;
  }

  function createStudentCourse(studentId: string, course: Course) {
    const normalizedCourse = normalizeCourse(course);
    if (!normalizedCourse.subject) return false;
    const existingCourse = courses.value.find((c) => c.subject === normalizedCourse.subject);
    if (existingCourse) {
      const alreadyAssigned = courseStudents.value.some((cs) => cs.courseId === existingCourse.id && cs.studentId === studentId);
      if (alreadyAssigned) return false;
      courseStudents.value.push({ courseId: existingCourse.id, studentId, currentLesson: 0, progress: 0 });
    } else {
      const id = normalizedCourse.id || createId("course");
      const newCourse = { ...normalizedCourse, id };
      courses.value.push(newCourse);
      courseStudents.value.push({ courseId: id, studentId, currentLesson: 0, progress: 0 });
    }
    return true;
  }

  function deleteStudentCourse(studentId: string, subject: string) {
    const course = courses.value.find((c) => c.subject === subject);
    if (!course) return false;
    const csIndex = courseStudents.value.findIndex((cs) => cs.courseId === course.id && cs.studentId === studentId);
    if (csIndex === -1) return false;
    const beforeCount = courseStudents.value.length;
    courseStudents.value = courseStudents.value.filter(
      (cs) => !(cs.courseId === course.id && cs.studentId === studentId)
    );
    if (courseStudents.value.length === beforeCount) return false;
    const otherStudents = courseStudents.value.some((cs) => cs.courseId === course.id);
    if (!otherStudents) {
      courses.value = courses.value.filter((c) => c.id !== course.id);
    }
    return true;
  }

  function checkInStudentCourse(studentId: string, subject: string) {
    const course = courses.value.find((c) => c.subject === subject);
    if (!course) return false;
    const cs = courseStudents.value.find((c) => c.courseId === course.id && c.studentId === studentId);
    if (!cs || cs.currentLesson >= course.totalLessons) return false;
    cs.currentLesson = cs.currentLesson + 1;
    cs.progress = calculateCourseProgress(cs.currentLesson, course.totalLessons);
    return true;
  }

  function undoChildCourseCheckIn(studentId: string, subject: string) {
    const course = courses.value.find((c) => c.subject === subject);
    if (!course) return false;
    const cs = courseStudents.value.find((c) => c.courseId === course.id && c.studentId === studentId);
    if (!cs || cs.currentLesson <= 0) return false;
    cs.currentLesson = cs.currentLesson - 1;
    cs.progress = calculateCourseProgress(cs.currentLesson, course.totalLessons);
    return true;
  }

  function deleteStudent(studentId: string) {
    if (items.value.length <= 1) return false;
    items.value = items.value.filter((child) => child.id !== studentId);
    materials.value = materials.value.map((material) => ({
      ...material,
      assignedStudentIds: material.assignedStudentIds.filter((id) => id !== studentId)
    }));
    classRecords.value = classRecords.value.filter((record) => record.studentId !== studentId);
    reminders.value = reminders.value.filter((reminder) => reminder.studentId !== studentId);
    scheduledLessons.value = scheduledLessons.value.filter((lesson) => lesson.studentId !== studentId);
    courseStudents.value = courseStudents.value.filter((cs) => cs.studentId !== studentId);
    groups.value = groups.value.map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => id !== studentId)
    }));
    if (activeChildId.value === studentId) {
      activeChildId.value = items.value[0]?.id ?? "";
    }
    return true;
  }

  function updateMistakeAnalysis(studentId: string, patch: MistakeBookPatch) {
    const child = items.value.find((item) => item.id === studentId);
    if (!child) return;
    child.mistakeBook = {
      ...child.mistakeBook,
      ...patch
    };
  }

  function createGroup(draft: Omit<ChildGroup, "id">) {
    const id = createId("group");
    groups.value.push({ ...draft, id });
    return id;
  }

  function updateGroup(groupId: string, patch: Partial<Omit<ChildGroup, "id">>) {
    const index = groups.value.findIndex((g) => g.id === groupId);
    if (index === -1) return false;
    Object.assign(groups.value[index], patch);
    return true;
  }

  function deleteGroup(groupId: string) {
    const beforeCount = groups.value.length;
    groups.value = groups.value.filter((g) => g.id !== groupId);
    return groups.value.length < beforeCount;
  }

  function addStudentToGroup(groupId: string, studentId: string) {
    const group = groups.value.find((g) => g.id === groupId);
    if (!group) return false;
    if (group.memberIds.includes(studentId)) return false;
    group.memberIds.push(studentId);
    return true;
  }

  function removeStudentFromGroup(groupId: string, studentId: string) {
    const group = groups.value.find((g) => g.id === groupId);
    if (!group) return false;
    const beforeCount = group.memberIds.length;
    group.memberIds = group.memberIds.filter((id) => id !== studentId);
    return group.memberIds.length < beforeCount;
  }

  function moveStudentToGroup(studentId: string, fromGroupId: string | null, toGroupId: string | null) {
    if (fromGroupId) removeStudentFromGroup(fromGroupId, studentId);
    if (toGroupId) addStudentToGroup(toGroupId, studentId);
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

  function batchDeleteMaterials(materialIds: string[]) {
    const idSet = new Set(materialIds);
    const beforeCount = materials.value.length;
    materials.value = materials.value.filter((material) => !idSet.has(material.id));
    return beforeCount - materials.value.length;
  }

  function batchAssignMaterials(materialIds: string[], studentIds: string[]) {
    const idSet = new Set(materialIds);
    let updated = 0;
    materials.value.forEach((material) => {
      if (idSet.has(material.id)) {
        const merged = new Set([...material.assignedStudentIds, ...studentIds]);
        material.assignedStudentIds = [...merged];
        material.syncStatus = "待同步";
        updated++;
      }
    });
    return updated;
  }

  function batchCategorizeMaterials(materialIds: string[], category: string) {
    const idSet = new Set(materialIds);
    let updated = 0;
    materials.value.forEach((material) => {
      if (idSet.has(material.id)) {
        material.category = category;
        material.syncStatus = "待同步";
        updated++;
      }
    });
    return updated;
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
        syncStatus: "已索引" as const,
        shareable: false
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

  function updateMaterialSource(sourceId: string, updates: Partial<MaterialSource>) {
    const source = materialSources.value.find((item) => item.id === sourceId);
    if (!source) return false;
    Object.assign(source, updates);
    return true;
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
    const child = items.value.find((item) => item.id === studentId);
    const course = courses.value.find((c) => c.subject === subject);
    if (!child || !course || !remindAt) return false;
    const cs = courseStudents.value.find((c) => c.courseId === course.id && c.studentId === studentId);
    if (!cs) return false;
    const lessonNumber = Math.min(cs.currentLesson + 1, course.totalLessons);
    createReminder({
      studentId,
      title: `${child.name}${course.subject}第 ${lessonNumber} 节课`,
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

  function updateAppSettings(patch: Partial<AppSettings>) {
    if (patch.mistakeAnalysisPrompt !== undefined) {
      appSettings.value.mistakeAnalysisPrompt = patch.mistakeAnalysisPrompt;
    }
    if (patch.similarQuestionsPrompt !== undefined) {
      appSettings.value.similarQuestionsPrompt = patch.similarQuestionsPrompt;
    }
    if (patch.defaultAiProviderId !== undefined) {
      appSettings.value.defaultAiProviderId = patch.defaultAiProviderId;
    }
    if (patch.defaultAiModelId !== undefined) {
      appSettings.value.defaultAiModelId = patch.defaultAiModelId;
    }
    if (patch.themeKey !== undefined) {
      appSettings.value.themeKey = patch.themeKey;
    }
    if (patch.teacherProfile !== undefined) {
      appSettings.value.teacherProfile = normalizeTeacherProfile(patch.teacherProfile);
    }
  }

  // --- 课程管理 ---
  function createCourse(draft: Omit<Course, "id">) {
    const id = createId("course");
    courses.value.push(normalizeCourse({ ...draft, id }));
    return id;
  }

  function updateCourse(courseId: string, patch: Partial<Course>) {
    const index = courses.value.findIndex((c) => c.id === courseId);
    if (index === -1) return false;
    courses.value[index] = normalizeCourse({ ...courses.value[index], ...patch });
    return true;
  }

  function deleteCourse(courseId: string) {
    const beforeCount = courses.value.length;
    courses.value = courses.value.filter((c) => c.id !== courseId);
    courseStudents.value = courseStudents.value.filter((cs) => cs.courseId !== courseId);
    scheduledLessons.value = scheduledLessons.value.filter((l) => l.courseId !== courseId);
    return courses.value.length < beforeCount;
  }

  function assignCourseToStudent(courseId: string, studentId: string) {
    const exists = courseStudents.value.some((cs) => cs.courseId === courseId && cs.studentId === studentId);
    if (exists) return false;
    courseStudents.value.push({ courseId, studentId, currentLesson: 0, progress: 0 });
    return true;
  }

  function unassignCourseFromStudent(courseId: string, studentId: string) {
    const beforeCount = courseStudents.value.length;
    courseStudents.value = courseStudents.value.filter(
      (cs) => !(cs.courseId === courseId && cs.studentId === studentId)
    );
    scheduledLessons.value = scheduledLessons.value.filter(
      (l) => !(l.courseId === courseId && l.studentId === studentId)
    );
    return courseStudents.value.length < beforeCount;
  }

  function getStudentCourses(studentId: string): Array<Course & { currentLesson: number; progress: number }> {
    return courseStudents.value
      .filter((cs) => cs.studentId === studentId)
      .map((cs) => {
        const course = courses.value.find((c) => c.id === cs.courseId);
        if (!course) return null;
        return { ...course, currentLesson: cs.currentLesson, progress: cs.progress };
      })
      .filter((c): c is Course & { currentLesson: number; progress: number } => c !== null);
  }

  function getCourseStudents(courseId: string): Array<Child & { currentLesson: number; progress: number }> {
    return courseStudents.value
      .filter((cs) => cs.courseId === courseId)
      .map((cs) => {
        const child = items.value.find((c) => c.id === cs.studentId);
        if (!child) return null;
        return { ...child, currentLesson: cs.currentLesson, progress: cs.progress };
      })
      .filter((c): c is Child & { currentLesson: number; progress: number } => c !== null);
  }

  function updateCourseStudentProgress(courseId: string, studentId: string, currentLesson: number) {
    const cs = courseStudents.value.find((c) => c.courseId === courseId && c.studentId === studentId);
    if (!cs) return false;
    const course = courses.value.find((c) => c.id === courseId);
    if (!course) return false;
    cs.currentLesson = currentLesson;
    cs.progress = course.totalLessons > 0 ? Math.round((currentLesson / course.totalLessons) * 100) : 0;
    return true;
  }

  watch(
    [items, materials, materialSources, classRecords, reminders, scheduledLessons, groups, appSettings, courses, courseStudents],
    () => {
      const state = currentPersistedState();
      writePersistedState(state);
      saveNativeState(state).catch((e) => {
        console.error("Failed to save native state:", e);
      });
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
    activeChild,
    activeChildId,
    activeChildRecords,
    activeChildHomework,
    activeChildReminders,
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
    materialsForStudent,
    createStudent,
    updateStudent,
    updateStudentCourse,
    createStudentCourse,
    deleteStudentCourse,
    checkInStudentCourse,
    undoChildCourseCheckIn,
    deleteStudent,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    batchDeleteMaterials,
    batchAssignMaterials,
    batchCategorizeMaterials,
    importScannedMaterials,
    createMaterialSource,
    updateMaterialSource,
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
    updateAppSettings,
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
    moveStudentToGroup,
    mistakeRecords,
    mistakeTags,
    isLoadingMistakeRecords,
    activeChildMistakeRecords,
    activeChildMistakeStats,
    loadMistakeRecords,
    loadMistakeTags,
    createMistakeTag,
    updateMistakeTag,
    deleteMistakeTag,
    createMistakeRecord,
    updateMistakeRecord,
    deleteMistakeRecord,
    batchUpdateMistakeMastery,
    toggleMistakeMastery,
    courses,
    courseStudents,
    createCourse,
    updateCourse,
    deleteCourse,
    assignCourseToStudent,
    unassignCourseFromStudent,
    getStudentCourses,
    getCourseStudents,
    updateCourseStudentProgress
  };
});
