import type { LearningReportSummary } from "../students/studentStore";

export function createLearningReportMarkdown(report: LearningReportSummary) {
  const weakPoints = report.weakPoints.length > 0 ? report.weakPoints.join("、") : "暂无";
  const nextActions = report.nextActions.map((action, index) => `${index + 1}. ${action}`).join("\n");

  return `# ${report.studentName} · 学习报告

- 学习目标：${report.goal}
- 学习风格：${report.style}
- 平均课程进度：${report.averageProgress}%
- 课堂记录：${report.classRecordCount} 条
- 作业条目：${report.homeworkCount} 条，其中待批改 ${report.pendingGradingCount} 条
- 分配资料：${report.materialCount} 份
- 薄弱点：${weakPoints}

## 下一步建议

${nextActions}
`;
}
