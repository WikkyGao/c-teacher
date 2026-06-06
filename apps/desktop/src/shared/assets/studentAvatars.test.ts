import { describe, expect, it } from "vitest";
import type { AppThemeKey } from "../../features/students/studentStore";
import { studentAvatarOptions, studentAvatarSourceFor } from "./studentAvatars";

describe("studentAvatars", () => {
  it("provides one boy and one girl avatar for every app theme", () => {
    const themes: AppThemeKey[] = ["turquoise", "night", "blue", "plum"];

    expect(studentAvatarOptions).toHaveLength(8);

    for (const theme of themes) {
      expect(studentAvatarSourceFor(theme, "male")).toContain(`${theme}-boy`);
      expect(studentAvatarSourceFor(theme, "female")).toContain(`${theme}-girl`);
    }
  });
});
