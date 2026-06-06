import { describe, expect, it } from "vitest";
import { navItems, settingsNavItem } from "./navigation";

describe("navigation", () => {
  it("exposes mobile preview as a feature page", () => {
    expect(navItems).not.toContainEqual({ key: "mobile", label: "手机预览" });
  });

  it("keeps schedule in the main nav and app settings as the footer entry", () => {
    expect(navItems.map((item) => item.key)).toContain("schedule");
    expect(navItems.map((item) => item.key)).not.toContain("plans");
    expect(navItems.map((item) => item.key)).not.toContain("reports");
    expect(navItems.map((item) => item.key)).not.toContain("mobile");
    expect(navItems.map((item) => item.key)).not.toContain("diagnostics");
    expect(navItems.map((item) => item.key)).not.toContain("settings");
    expect(settingsNavItem).toEqual({ key: "settings", label: "App 设置" });
  });
});
