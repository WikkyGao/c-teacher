import { describe, expect, it } from "vitest";
import type { PersistedState } from "../students/studentStore";
import { buildWorkspaceBackup, isWorkspaceBackup, workspaceStateFromStore } from "./workspaceBackup";

type CompletePersistedState = Required<PersistedState>;

function sampleState(): CompletePersistedState {
  return {
    students: [
      {
        id: "student-a",
        name: "学生 A",
        gender: "female",
        goal: "提分",
        style: "讲练结合",
        courses: [{ subject: "数学", currentLesson: 1, totalLessons: 10, progress: 10 }],
        materials: [],
        mistakeBook: {
          summary: "错题本",
          aiPending: 0,
          subjects: ["数学"],
          weakPoints: [],
          analysis: "",
          similarQuestions: "",
          knowledgeInsight: ""
        }
      }
    ],
    materials: [],
    materialSources: [],
    classRecords: [],
    reminders: [],
    scheduledLessons: [
      {
        id: "lesson-a",
        studentId: "student-a",
        subject: "数学",
        startsAt: 1780912800000,
        durationMinutes: 90,
        topic: "函数",
        note: "带讲义"
      }
    ],
    appSettings: {
      aiProviders: [
        {
          id: "provider-a",
          name: "供应商 A",
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret",
          models: [{ id: "model-a", name: "model-a", purpose: "通用", isDefault: true }]
        }
      ],
      defaultAiProviderId: "provider-a",
      defaultAiModelId: "model-a",
      themeKey: "night",
      teacherProfile: {
        name: "李老师",
        title: "数学老师",
        bio: "本机工作台"
      }
    }
  };
}

describe("workspaceBackup", () => {
  it("builds a complete backup payload from workspace state", () => {
    const state = sampleState();

    const backup = buildWorkspaceBackup(state, 1780912800);

    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe("1780912800");
    expect(backup.state.scheduledLessons).toEqual(state.scheduledLessons);
    expect(backup.state.appSettings).toEqual(state.appSettings);
  });

  it("validates backup shape before restore", () => {
    expect(isWorkspaceBackup(buildWorkspaceBackup(sampleState(), 1780912800))).toBe(true);
    expect(isWorkspaceBackup({ version: 1, exportedAt: "1780912800", state: { students: [] } })).toBe(false);
    expect(isWorkspaceBackup({ version: 2, exportedAt: "1780912800", state: sampleState() })).toBe(false);
  });

  it("reads the full store state used by settings and backup pages", () => {
    const state = sampleState();
    const storeLike = {
      items: state.students,
      materials: state.materials,
      materialSources: state.materialSources,
      classRecords: state.classRecords,
      reminders: state.reminders,
      scheduledLessons: state.scheduledLessons,
      appSettings: state.appSettings
    };

    expect(workspaceStateFromStore(storeLike)).toEqual(state);
  });
});
