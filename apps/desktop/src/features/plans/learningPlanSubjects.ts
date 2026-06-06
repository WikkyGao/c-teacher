import type { Course } from "../students/studentStore";
import { K12_MISTAKE_BOOK_SUBJECTS } from "../students/studentStore";

export function buildLearningPlanSubjectOptions(courses: Course[]) {
  const courseSubjects = courses.map((course) => course.subject.trim()).filter(Boolean);
  return Array.from(new Set([...K12_MISTAKE_BOOK_SUBJECTS, ...courseSubjects])).map((subject) => ({
    label: subject,
    value: subject
  }));
}

export function learningPlanSubjectCountText(subjects: string[]) {
  return `可创建 ${subjects.length} 个中小学科目`;
}
