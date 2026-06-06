import { describe, expect, it } from "vitest";
import { createLearningReportMarkdown } from "./reportExport";
import type { LearningReportSummary } from "../students/studentStore";

describe("reportExport", () => {
  it("creates shareable markdown for a learning report", () => {
    const report: LearningReportSummary = {
      studentId: "chen",
      studentName: "陈一诺",
      goal: "期中数学 90+",
      style: "图像化讲解",
      averageProgress: 58,
      classRecordCount: 2,
      homeworkCount: 2,
      pendingGradingCount: 1,
      materialCount: 4,
      weakPoints: ["函数图像", "长难句拆解"],
      nextActions: ["批改 1 条待处理作业", "推进下一阶段课程目标"]
    };

    expect(createLearningReportMarkdown(report)).toBe(`# 陈一诺 · 学习报告

- 学习目标：期中数学 90+
- 学习风格：图像化讲解
- 平均课程进度：58%
- 课堂记录：2 条
- 作业条目：2 条，其中待批改 1 条
- 分配资料：4 份
- 薄弱点：函数图像、长难句拆解

## 下一步建议

1. 批改 1 条待处理作业
2. 推进下一阶段课程目标
`);
  });
});
