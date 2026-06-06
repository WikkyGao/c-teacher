import { describe, expect, it } from "vitest";
import { createMaterialFileDraft } from "./materialFile";

describe("createMaterialFileDraft", () => {
  it("derives material fields from a local file path", () => {
    expect(createMaterialFileDraft("/Users/teacher/资料/函数图像讲义.pdf")).toEqual({
      title: "函数图像讲义.pdf",
      category: "PDF",
      tags: ["pdf"],
      sourcePath: "/Users/teacher/资料/函数图像讲义.pdf"
    });
  });
});
