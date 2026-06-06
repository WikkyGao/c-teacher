import { describe, expect, it } from "vitest";
import { K12_MISTAKE_BOOK_SUBJECTS } from "../students/studentStore";
import { buildLearningPlanSubjectOptions, learningPlanSubjectCountText } from "./learningPlanSubjects";

describe("learningPlanSubjects", () => {
  it("offers all K12 subjects when creating learning plans", () => {
    const options = buildLearningPlanSubjectOptions([
      { subject: "数学", currentLesson: 8, totalLessons: 16, progress: 75 },
      { subject: "英语", currentLesson: 3, totalLessons: 10, progress: 40 }
    ]);

    expect(options.map((option) => option.value)).toEqual(K12_MISTAKE_BOOK_SUBJECTS);
  });

  it("summarizes available subjects for compact plan editing", () => {
    expect(learningPlanSubjectCountText(K12_MISTAKE_BOOK_SUBJECTS)).toBe("可创建 11 个中小学科目");
  });
});
