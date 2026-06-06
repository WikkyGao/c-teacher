import { describe, expect, it } from "vitest";
import { mobilePlatformOptions, mobilePlatforms } from "./mobilePreviewConfig";

describe("mobilePreviewConfig", () => {
  it("supports mini program and app preview modes", () => {
    expect(mobilePlatformOptions).toEqual([
      { label: "小程序", value: "miniProgram" },
      { label: "App", value: "app" }
    ]);
  });

  it("provides shell copy and capability notes for each platform", () => {
    expect(mobilePlatforms.miniProgram.previewTitle).toContain("小程序");
    expect(mobilePlatforms.app.previewTitle).toContain("App");
    expect(mobilePlatforms.miniProgram.capabilities.length).toBeGreaterThanOrEqual(3);
    expect(mobilePlatforms.app.capabilities.length).toBeGreaterThanOrEqual(3);
  });
});
