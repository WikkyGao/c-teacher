import { describe, expect, it } from "vitest";
import type { AppThemeKey } from "../../features/children/childStore";
import { childAvatarOptions, childAvatarSourceFor } from "./childAvatars";

describe("studentAvatars", () => {
  it("provides one boy and one girl avatar for every app theme", () => {
    const themes: AppThemeKey[] = ["turquoise", "night", "blue", "plum"];

    expect(childAvatarOptions).toHaveLength(8);

    for (const theme of themes) {
      expect(childAvatarSourceFor(theme, "male")).toContain(`${theme}-boy`);
      expect(childAvatarSourceFor(theme, "female")).toContain(`${theme}-girl`);
    }
  });
});
