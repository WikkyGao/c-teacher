import { describe, expect, it } from "vitest";
import { K12_MISTAKE_BOOK_SUBJECTS } from "./childStore";
import { buildMistakeBookSubjectOptions, mistakeBookSubjectCountText } from "./mistakeBookPanel";

describe("mistakeBookPanel", () => {
  it("summarizes many subjects instead of expanding them all in the detail panel", () => {
    expect(mistakeBookSubjectCountText(K12_MISTAKE_BOOK_SUBJECTS)).toBe("已覆盖 11 个科目");
    expect(buildMistakeBookSubjectOptions(K12_MISTAKE_BOOK_SUBJECTS)).toEqual(
      K12_MISTAKE_BOOK_SUBJECTS.map((subject) => ({ label: subject, value: subject }))
    );
  });
});
