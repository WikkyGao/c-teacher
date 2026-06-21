export function buildMistakeBookSubjectOptions(subjects: string[]) {
  return subjects.map((subject) => ({
    label: subject,
    value: subject
  }));
}

export function mistakeBookSubjectCountText(subjects: string[]) {
  return `已覆盖 ${subjects.length} 个科目`;
}
