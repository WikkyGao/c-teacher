import { describe, expect, it } from "vitest";
import { clampStudentDetailWidth, defaultStudentDetailWidth } from "./studentLayout";

describe("studentLayout", () => {
  it("keeps the detail panel width inside the draggable range", () => {
    expect(defaultStudentDetailWidth).toBe(380);
    expect(clampStudentDetailWidth(260)).toBe(320);
    expect(clampStudentDetailWidth(520)).toBe(520);
    expect(clampStudentDetailWidth(780)).toBe(640);
  });
});
