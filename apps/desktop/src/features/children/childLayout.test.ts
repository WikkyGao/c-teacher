import { describe, expect, it } from "vitest";
import { clampChildDetailWidth, defaultChildDetailWidth } from "./childLayout";

describe("studentLayout", () => {
  it("keeps the detail panel width inside the draggable range", () => {
    expect(defaultChildDetailWidth).toBe(380);
    expect(clampChildDetailWidth(260)).toBe(320);
    expect(clampChildDetailWidth(520)).toBe(520);
    expect(clampChildDetailWidth(780)).toBe(640);
  });
});
