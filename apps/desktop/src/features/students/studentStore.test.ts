import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appThemes, K12_MISTAKE_BOOK_SUBJECTS, useStudentStore } from "./studentStore";

describe("studentStore", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    });
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("selects the active student", () => {
    const store = useStudentStore();

    store.selectStudent("meng");

    expect(store.activeStudent.name).toBe("孟然");
  });

  it("updates mistake book AI analysis", () => {
    const store = useStudentStore();

    store.updateMistakeAnalysis("chen", {
      analysis: "新的错误分析",
      similarQuestions: "新的类似题",
      knowledgeInsight: "新的知识点分析",
      aiPending: 2
    });

    expect(store.activeStudent.mistakeBook.analysis).toBe("新的错误分析");
    expect(store.activeStudent.mistakeBook.similarQuestions).toBe("新的类似题");
    expect(store.activeStudent.mistakeBook.knowledgeInsight).toBe("新的知识点分析");
    expect(store.activeStudent.mistakeBook.aiPending).toBe(2);
  });

  it("supports all primary and secondary school subjects in mistake books", () => {
    const store = useStudentStore();

    expect(store.activeStudent.mistakeBook.subjects).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
  });

  it("describes mistake books as multi-subject notebooks", () => {
    const store = useStudentStore();

    expect(store.activeStudent.mistakeBook.summary).toContain("覆盖 11 个中小学科目");
  });

  it("migrates cached mistake books to all K12 subjects", () => {
    localStorage.setItem(
      "c-teacher.workspace.v1",
      JSON.stringify({
        students: [
          {
            id: "cached",
            name: "缓存学生",
            goal: "缓存目标",
            style: "缓存风格",
            courses: [{ subject: "数学", currentLesson: 1, totalLessons: 10, progress: 10 }],
            materials: [],
            mistakeBook: {
              summary: "错题本 · 数学 1 题",
              aiPending: 0,
              subjects: ["数学"],
              weakPoints: ["函数"],
              analysis: "旧分析",
              similarQuestions: "旧类似题",
              knowledgeInsight: "旧知识点"
            }
          }
        ],
        materials: [],
        materialSources: [],
        classRecords: [],
        reminders: []
      })
    );
    setActivePinia(createPinia());

    const store = useStudentStore();

    expect(store.activeStudent.mistakeBook.subjects).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
    expect(store.activeStudent.mistakeBook.summary).toContain("覆盖 11 个中小学科目");
  });

  it("creates, updates and deletes students", () => {
    const store = useStudentStore();

    store.createStudent({
      name: "新学生",
      goal: "完成入门课",
      style: "高频反馈",
      courses: [{ subject: "数学", currentLesson: 1, totalLessons: 8, progress: 12 }],
      materials: ["入门讲义"]
    });

    expect(store.activeStudent.name).toBe("新学生");
    expect(store.activeStudent.mistakeBook.subjects).toEqual(K12_MISTAKE_BOOK_SUBJECTS);

    store.updateStudent(store.activeStudent.id, {
      name: "新学生 A",
      goal: "完成基础课",
      style: "慢速讲解",
      courses: [{ subject: "英语", currentLesson: 2, totalLessons: 10, progress: 20 }],
      materials: ["阅读卡片"]
    });

    expect(store.activeStudent.name).toBe("新学生 A");
    expect(store.activeStudent.courses[0].subject).toBe("英语");

    expect(store.deleteStudent(store.activeStudent.id)).toBe(true);
    expect(store.items.some((student) => student.name === "新学生 A")).toBe(false);
  });

  it("creates materials, class records and reminders", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createMaterial({
      title: "新资料",
      category: "数学",
      tags: ["函数"],
      assignedStudentIds: [studentId],
      sourceType: "smb",
      sourcePath: "smb://nas/materials"
    });
    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });
    store.createReminder({
      studentId,
      title: "下次课提醒",
      remindAt: Date.now(),
      relatedType: "课程"
    });

    expect(store.materials[0].title).toBe("新资料");
    expect(store.classRecords[0].lessonContent).toBe("函数复盘");
    expect(store.reminders[0].title).toBe("下次课提醒");
  });

  it("updates class records", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });

    store.updateClassRecord(store.classRecords[0].id, {
      studentId,
      subject: "物理",
      lessonContent: "受力分析",
      performance: "需要慢速拆解",
      homework: "画受力图 3 题"
    });

    expect(store.classRecords[0].subject).toBe("物理");
    expect(store.classRecords[0].lessonContent).toBe("受力分析");
    expect(store.classRecords[0].homework).toBe("画受力图 3 题");
    expect(store.classRecords[0].gradingStatus).toBe("待批改");
  });

  it("updates homework grading status", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });

    const recordId = store.classRecords[0].id;

    expect(store.classRecords[0].gradingStatus).toBe("待批改");
    expect(store.updateHomeworkGradingStatus(recordId, "已批改")).toBe(true);
    expect(store.classRecords[0].gradingStatus).toBe("已批改");
    expect(store.activeStudentHomework[0].gradingStatus).toBe("已批改");
    expect(store.updateHomeworkGradingStatus("missing-record", "已批改")).toBe(false);
  });

  it("resets grading status when homework content changes", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });
    const recordId = store.classRecords[0].id;

    store.updateHomeworkGradingStatus(recordId, "已批改");
    store.updateClassRecord(recordId, {
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 4-6 题"
    });

    expect(store.classRecords[0].gradingStatus).toBe("待批改");
  });

  it("updates a student course plan", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    expect(
      store.updateStudentCourse(studentId, "数学", {
        subject: "数学",
        currentLesson: 9,
        totalLessons: 16,
        progress: 80
      })
    ).toBe(true);

    expect(store.activeStudent.courses.find((course) => course.subject === "数学")?.currentLesson).toBe(9);
    expect(store.activeStudent.courses.find((course) => course.subject === "数学")?.progress).toBe(56);
    expect(store.updateStudentCourse(studentId, "不存在", { subject: "物理", currentLesson: 1, totalLessons: 8, progress: 12 })).toBe(false);
  });

  it("calculates course progress from completed and total lessons", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    expect(
      store.createStudentCourse(studentId, {
        subject: "化学",
        currentLesson: 3,
        totalLessons: 12,
        progress: 99
      })
    ).toBe(true);

    const course = store.activeStudent.courses.find((item) => item.subject === "化学");

    expect(course).toMatchObject({
      currentLesson: 3,
      totalLessons: 12,
      progress: 25
    });
  });

  it("checks in completed lessons and recalculates progress", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.updateStudentCourse(studentId, "数学", {
      subject: "数学",
      currentLesson: 15,
      totalLessons: 16,
      progress: 1
    });

    expect(store.checkInStudentCourse(studentId, "数学")).toBe(true);
    expect(store.activeStudent.courses.find((course) => course.subject === "数学")).toMatchObject({
      currentLesson: 16,
      totalLessons: 16,
      progress: 100
    });
    expect(store.checkInStudentCourse(studentId, "数学")).toBe(false);
    expect(store.checkInStudentCourse(studentId, "不存在")).toBe(false);
  });

  it("undoes completed lesson check-ins and recalculates progress", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.updateStudentCourse(studentId, "数学", {
      subject: "数学",
      currentLesson: 1,
      totalLessons: 10,
      progress: 99
    });

    expect(store.undoStudentCourseCheckIn(studentId, "数学")).toBe(true);
    expect(store.activeStudent.courses.find((course) => course.subject === "数学")).toMatchObject({
      currentLesson: 0,
      totalLessons: 10,
      progress: 0
    });
    expect(store.undoStudentCourseCheckIn(studentId, "数学")).toBe(false);
    expect(store.undoStudentCourseCheckIn(studentId, "不存在")).toBe(false);
  });

  it("creates student course plans and keeps mistake book subjects in sync", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    expect(
      store.createStudentCourse(studentId, {
        subject: "物理",
        currentLesson: 1,
        totalLessons: 8,
        progress: 12
      })
    ).toBe(true);

    expect(store.activeStudent.courses.find((course) => course.subject === "物理")).toMatchObject({
      currentLesson: 1,
      totalLessons: 8,
      progress: 13
    });
    expect(store.activeStudent.mistakeBook.subjects).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
    expect(
      store.createStudentCourse(studentId, {
        subject: "物理",
        currentLesson: 2,
        totalLessons: 8,
        progress: 24
      })
    ).toBe(false);
    expect(store.activeStudent.courses.filter((course) => course.subject === "物理")).toHaveLength(1);
  });

  it("deletes student course plans without removing the final course", () => {
    const store = useStudentStore();

    store.createStudent({
      name: "单科学生",
      goal: "先完成数学",
      style: "小步推进",
      courses: [{ subject: "数学", currentLesson: 1, totalLessons: 8, progress: 12 }],
      materials: []
    });
    const studentId = store.activeStudent.id;

    expect(store.deleteStudentCourse(studentId, "数学")).toBe(false);
    expect(store.activeStudent.courses.map((course) => course.subject)).toEqual(["数学"]);

    expect(
      store.createStudentCourse(studentId, {
        subject: "英语",
        currentLesson: 1,
        totalLessons: 10,
        progress: 10
      })
    ).toBe(true);
    expect(store.deleteStudentCourse(studentId, "数学")).toBe(true);
    expect(store.activeStudent.courses.map((course) => course.subject)).toEqual(["英语"]);
    expect(store.activeStudent.mistakeBook.subjects).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
    expect(store.deleteStudentCourse(studentId, "不存在")).toBe(false);
  });

  it("deletes reminders", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createReminder({
      studentId,
      title: "临时提醒",
      remindAt: Date.now(),
      relatedType: "批改"
    });
    const reminderId = store.reminders[0].id;

    expect(store.deleteReminder(reminderId)).toBe(true);
    expect(store.reminders.some((reminder) => reminder.id === reminderId)).toBe(false);
    expect(store.deleteReminder("missing-reminder")).toBe(false);
  });

  it("marks reminders complete, undoes completion and prioritizes incomplete reminders", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createReminder({
      studentId,
      title: "较晚未完成提醒",
      remindAt: new Date("2026-06-03T18:00:00+08:00").getTime(),
      relatedType: "课程"
    });
    store.createReminder({
      studentId,
      title: "较早未完成提醒",
      remindAt: new Date("2026-06-02T18:00:00+08:00").getTime(),
      relatedType: "作业"
    });

    const completedId = store.reminders[0].id;
    expect(store.completeReminder(completedId)).toBe(true);
    expect(store.sortedReminders.map((reminder) => reminder.id)).not.toContain(completedId);
    expect(store.sortedReminders.every((reminder) => reminder.status !== "已完成")).toBe(true);
    expect(store.completedReminders[0]).toMatchObject({ title: "较早未完成提醒", status: "已完成" });

    expect(store.undoCompleteReminder(completedId)).toBe(true);
    expect(store.sortedReminders.map((reminder) => reminder.title)).toContain("较早未完成提醒");
    expect(store.completeReminder("missing-reminder")).toBe(false);
    expect(store.undoCompleteReminder("missing-reminder")).toBe(false);
  });

  it("creates course reminders from a student course plan", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;
    const remindAt = new Date("2026-06-12T18:00:00+08:00").getTime();

    expect(store.createCourseReminder(studentId, "数学", remindAt)).toBe(true);

    expect(store.reminders[0]).toMatchObject({
      studentId,
      title: `${store.activeStudent.name}数学第 9 节课`,
      remindAt,
      relatedType: "课程",
      status: "待提醒"
    });
    expect(store.createCourseReminder(studentId, "不存在", remindAt)).toBe(false);
    expect(store.createCourseReminder("missing-student", "数学", remindAt)).toBe(false);
  });

  it("does not create course reminder titles beyond the total lesson count", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;
    const remindAt = new Date("2026-06-12T18:00:00+08:00").getTime();

    store.updateStudentCourse(studentId, "数学", {
      subject: "数学",
      currentLesson: 16,
      totalLessons: 16,
      progress: 100
    });

    expect(store.createCourseReminder(studentId, "数学", remindAt)).toBe(true);
    expect(store.reminders[0].title).toBe(`${store.activeStudent.name}数学第 16 节课`);
  });

  it("derives student material titles from assigned materials", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createMaterial({
      title: "新分配讲义",
      category: "数学",
      tags: ["讲义"],
      assignedStudentIds: [studentId],
      sourceType: "local",
      sourcePath: "/tmp/新分配讲义.pdf"
    });

    expect(store.materialTitlesForStudent(studentId)).toContain("新分配讲义");
  });

  it("updates and deletes materials", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createMaterial({
      title: "待编辑资料",
      category: "数学",
      tags: ["旧标签"],
      assignedStudentIds: [],
      sourceType: "local",
      sourcePath: "/tmp/material.pdf"
    });
    const materialId = store.materials[0].id;

    expect(
      store.updateMaterial(materialId, {
        title: "已编辑资料",
        category: "物理",
        tags: ["新标签"],
        assignedStudentIds: [studentId],
        sourceType: "smb",
        sourcePath: "smb://nas/material.pdf"
      })
    ).toBe(true);
    expect(store.materials[0].title).toBe("已编辑资料");
    expect(store.materialTitlesForStudent(studentId)).toContain("已编辑资料");

    expect(store.deleteMaterial(materialId)).toBe(true);
    expect(store.materials.some((material) => material.id === materialId)).toBe(false);
    expect(store.deleteMaterial("missing-material")).toBe(false);
  });

  it("tests local material sources by path and deletes sources", () => {
    const store = useStudentStore();

    store.createMaterialSource({
      protocol: "local",
      name: "本地资料",
      host: "",
      path: "/tmp/materials",
      authMethod: "本机"
    });
    const sourceId = store.materialSources[0].id;

    expect(store.testMaterialSource(sourceId)).toBe(true);
    expect(store.materialSources[0].connectionStatus).toBe("可用");
    expect(store.deleteMaterialSource(sourceId)).toBe(true);
    expect(store.materialSources.some((source) => source.id === sourceId)).toBe(false);
    expect(store.deleteMaterialSource("missing-source")).toBe(false);
  });

  it("builds calendar plan items from reminders and class records", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createReminder({
      studentId,
      title: "阶段报告",
      remindAt: new Date("2026-06-10T10:00:00+08:00").getTime(),
      relatedType: "报告"
    });
    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });

    expect(store.calendarPlanItems[0].title).toBe("阶段报告");
    expect(store.calendarPlanItems.some((item) => item.title.includes("函数复盘"))).toBe(true);
  });

  it("creates, updates and deletes scheduled lessons", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;
    const startsAt = new Date("2026-06-08T18:00:00+08:00").getTime();

    store.createScheduledLesson({
      studentId,
      subject: "数学",
      startsAt,
      durationMinutes: 90,
      topic: "函数图像复盘",
      note: "带讲义"
    });

    expect(store.scheduledLessons[0]).toMatchObject({
      studentId,
      subject: "数学",
      startsAt,
      durationMinutes: 90,
      topic: "函数图像复盘",
      note: "带讲义"
    });
    expect(store.scheduledLessonCalendarItems[0]).toMatchObject({
      studentName: store.activeStudent.name,
      subject: "数学",
      durationMinutes: 90
    });

    const lessonId = store.scheduledLessons[0].id;
    expect(
      store.updateScheduledLesson(lessonId, {
        studentId,
        subject: "物理",
        startsAt: startsAt + 60 * 60 * 1000,
        durationMinutes: 60,
        topic: "受力分析",
        note: ""
      })
    ).toBe(true);
    expect(store.scheduledLessons[0]).toMatchObject({
      subject: "物理",
      durationMinutes: 60,
      topic: "受力分析"
    });

    expect(store.deleteScheduledLesson(lessonId)).toBe(true);
    expect(store.scheduledLessons.some((lesson) => lesson.id === lessonId)).toBe(false);
    expect(store.updateScheduledLesson("missing-lesson", store.scheduledLessons[0])).toBe(false);
    expect(store.deleteScheduledLesson("missing-lesson")).toBe(false);
  });

  it("cleans scheduled lessons when deleting a student", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createScheduledLesson({
      studentId,
      subject: "数学",
      startsAt: new Date("2026-06-08T18:00:00+08:00").getTime(),
      durationMinutes: 90,
      topic: "函数图像复盘",
      note: ""
    });

    expect(store.deleteStudent(studentId)).toBe(true);
    expect(store.scheduledLessons.some((lesson) => lesson.studentId === studentId)).toBe(false);
  });

  it("manages AI providers, models and default model settings", () => {
    const store = useStudentStore();

    store.createAiProvider({
      name: "测试供应商",
      baseUrl: "https://api.example.com/v1",
      apiKey: "test-key",
      models: [
        {
          id: "model-test",
          name: "model-a",
          purpose: "错题分析",
          isDefault: true
        }
      ]
    });

    const providerId = store.appSettings.aiProviders[0].id;
    expect(store.defaultAiModel?.name).toBe("model-a");

    expect(
      store.updateAiProvider(providerId, {
        name: "已编辑供应商",
        baseUrl: "https://api.edited.com/v1",
        apiKey: "edited-key",
        models: [
          {
            id: "model-edited",
            name: "model-b",
            purpose: "报告生成",
            isDefault: true
          }
        ]
      })
    ).toBe(true);
    expect(store.appSettings.aiProviders[0].name).toBe("已编辑供应商");
    expect(store.defaultAiModel).toMatchObject({ providerId, name: "model-b" });

    expect(store.setDefaultAiModel(providerId, "model-edited")).toBe(true);
    expect(store.appSettings.defaultAiProviderId).toBe(providerId);
    expect(store.appSettings.defaultAiModelId).toBe("model-edited");

    expect(store.deleteAiProvider(providerId)).toBe(true);
    expect(store.appSettings.aiProviders.some((provider) => provider.id === providerId)).toBe(false);
    expect(store.updateAiProvider("missing-provider", store.appSettings.aiProviders[0])).toBe(false);
    expect(store.deleteAiProvider("missing-provider")).toBe(false);
    expect(store.setDefaultAiModel("missing-provider", "missing-model")).toBe(false);
  });

  it("switches app themes", () => {
    const store = useStudentStore();

    expect(["松石白板", "墨蓝夜读", "晴蓝讲台", "梅紫书房"]).toEqual(
      expect.arrayContaining(appThemes.map((theme) => theme.name))
    );
    expect(store.appSettings.themeKey).toBe("blue");
    expect(store.setAppTheme("night")).toBe(true);
    expect(store.appSettings.themeKey).toBe("night");
    expect(store.setAppTheme("blue")).toBe(true);
    expect(store.appSettings.themeKey).toBe("blue");
    expect(store.setAppTheme("plum")).toBe(true);
    expect(store.appSettings.themeKey).toBe("plum");
    expect(store.setAppTheme("missing-theme")).toBe(false);
    expect(store.appSettings.themeKey).toBe("plum");
  });

  it("normalizes and updates the teacher profile", () => {
    localStorage.setItem(
      "c-teacher.workspace.v1",
      JSON.stringify({
        students: [],
        materials: [],
        materialSources: [],
        classRecords: [],
        reminders: [],
        appSettings: {
          aiProviders: [],
          defaultAiProviderId: "",
          defaultAiModelId: "",
          themeKey: "blue"
        }
      })
    );
    setActivePinia(createPinia());

    const store = useStudentStore();

    expect(store.appSettings.teacherProfile).toEqual({
      name: "王老师",
      title: "课程规划老师",
      bio: "C-teacher · 本机教学工作台"
    });

    expect(
      store.updateTeacherProfile({
        name: "  李老师  ",
        title: "  数学教研负责人  ",
        bio: "  初高中数学规划  "
      })
    ).toBe(true);
    expect(store.appSettings.teacherProfile).toEqual({
      name: "李老师",
      title: "数学教研负责人",
      bio: "初高中数学规划"
    });

    expect(store.updateTeacherProfile({ name: "  " })).toBe(false);
    expect(store.appSettings.teacherProfile.name).toBe("李老师");
  });

  it("derives active student homework items from class records", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });

    expect(store.activeStudentHomework[0]).toMatchObject({
      studentId,
      subject: "数学",
      homework: "第 1-3 题"
    });
  });

  it("builds student learning report summaries", () => {
    const store = useStudentStore();
    const studentId = store.activeStudent.id;

    store.createClassRecord({
      studentId,
      subject: "数学",
      lessonContent: "函数复盘",
      performance: "稳定",
      homework: "第 1-3 题"
    });

    const report = store.learningReports.find((item) => item.studentId === studentId);

    expect(report).toMatchObject({
      studentName: store.activeStudent.name,
      goal: store.activeStudent.goal,
      classRecordCount: 2,
      homeworkCount: 2,
      pendingGradingCount: 2
    });
    expect(report?.averageProgress).toBe(40);
    expect(report?.weakPoints).toContain("函数图像");
    expect(report?.nextActions[0]).toContain("优先处理");
  });

  it("imports scanned materials without duplicating paths", () => {
    const store = useStudentStore();

    const firstImportCount = store.importScannedMaterials(
      [
        { title: "函数练习.pdf", sourcePath: "/tmp/函数练习.pdf", fileType: "pdf" },
        { title: "课堂视频.mp4", sourcePath: "/tmp/课堂视频.mp4", fileType: "mp4" }
      ],
      "local"
    );
    const secondImportCount = store.importScannedMaterials(
      [{ title: "函数练习.pdf", sourcePath: "/tmp/函数练习.pdf", fileType: "pdf" }],
      "local"
    );

    expect(firstImportCount).toBe(2);
    expect(secondImportCount).toBe(0);
    expect(store.materials.filter((material) => material.sourcePath === "/tmp/函数练习.pdf")).toHaveLength(1);
  });
});
