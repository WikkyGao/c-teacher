import { describe, expect, it } from "vitest";
import { appThemes } from "../features/students/studentStore";
import { appThemeTokens, naiveThemeOverridesFor } from "./appThemeOverrides";

describe("app theme overrides", () => {
  it("provides readable Naive UI colors for every app theme", () => {
    for (const theme of appThemes) {
      const tokens = appThemeTokens[theme.key];
      const overrides = naiveThemeOverridesFor(theme.key);

      expect(tokens.text).toMatch(/^#/);
      expect(tokens.panel).toMatch(/^#/);
      expect(overrides.common?.textColor1).toBe(tokens.text);
      expect(overrides.common?.inputColor).toBe(tokens.panel);
      expect(overrides.Input?.textColor).toBe(tokens.text);
      expect(overrides.Select?.peers?.InternalSelection?.textColor).toBe(tokens.text);
      expect(overrides.Button?.colorPrimary).toBe(tokens.primaryReadable);
      expect(overrides.Button?.textColorTextPrimary).toBe(tokens.primaryReadable);
      expect(overrides.Button?.colorSecondary).toBe(tokens.panel);
      expect(overrides.Button?.colorTertiary).toBe(tokens.panelRaised);
      expect(overrides.Button?.textColor).toBe(tokens.text);
      expect(overrides.Button?.textColorHover).toBe(tokens.primaryReadable);
    }
  });

  it("keeps night theme controls on dark surfaces with light text", () => {
    const overrides = naiveThemeOverridesFor("night");

    expect(overrides.common?.textColor1).toBe("#f3fbff");
    expect(overrides.common?.inputColor).toBe("#223445");
    expect(overrides.Card?.color).toBe("#223445");
    expect(overrides.Button?.colorPrimary).toBe("#cbfff5");
    expect(overrides.Button?.colorSecondary).toBe("#223445");
    expect(overrides.Button?.textColor).toBe("#f3fbff");
  });
});
