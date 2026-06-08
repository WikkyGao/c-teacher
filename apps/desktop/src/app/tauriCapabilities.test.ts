import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tauri capabilities", () => {
  it("allows dialog open and save for backup import/export", () => {
    const capabilityPath = resolve(process.cwd(), "src-tauri/capabilities/default.json");
    const capability = JSON.parse(readFileSync(capabilityPath, "utf-8")) as {
      permissions?: unknown[];
    };

    expect(capability.permissions).toEqual(expect.arrayContaining(["core:default", "dialog:default"]));
  });
});
