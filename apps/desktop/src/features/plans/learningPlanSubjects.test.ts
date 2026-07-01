import { describe, expect, it } from "vitest";
import { K12_MISTAKE_BOOK_SUBJECTS } from "../children/childStore";
import { buildLearningPlanSubjectOptions, learningPlanSubjectCountText } from "./learningPlanSubjects";

describe("learningPlanSubjects", () => {
  it("offers all K12 subjects when creating learning plans", () => {
    const options = buildLearningPlanSubjectOptions([
      { id: "c1", name: "数学", subject: "数学", totalLessons: 16, lessons: Array.from({ length: 16 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })), scope: "personal" as const, studentIds: ["c1"], scheduleMode: "weekly" as const, schedule: { startDate: "2026-01-01", startTime: "14:00", duration: 60, weekday: 1 } },
      { id: "c2", name: "英语", subject: "英语", totalLessons: 10, lessons: Array.from({ length: 10 }, (_, i) => ({ title: `第${i + 1}课`, materialIds: [], order: i })), scope: "personal" as const, studentIds: ["c2"], scheduleMode: "weekly" as const, schedule: { startDate: "2026-01-01", startTime: "14:00", duration: 60, weekday: 1 } }
    ]);

    expect(options.map((option) => option.value)).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
  });

  it("summarizes available subjects for compact plan editing", () => {
    expect(learningPlanSubjectCountText(K12_MISTAKE_BOOK_SUBJECTS)).toBe("可创建 11 个中小学科目");
  });
});
