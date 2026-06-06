import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMistake } from "./mistakeApi";

describe("analyzeMistake", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts mistake data to the local AI gateway", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          questionText: "函数图像平移",
          correctAnswer: "待教师确认",
          mistakeReason: "条件抽取不稳定",
          knowledgePoints: ["函数图像"],
          similarQuestions: ["同类题 1"],
          teacherReviewRequired: true
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "函数图像平移",
      studentAnswer: "向左"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18080/v1/ai/mistakes/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          studentId: "chen",
          subject: "数学",
          questionText: "函数图像平移",
          studentAnswer: "向左"
        })
      })
    );
    expect(result.teacherReviewRequired).toBe(true);
    expect(result.mistakeReason).toBe("条件抽取不稳定");
  });

  it("posts selected mistake image metadata to the local AI gateway", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          questionText: "图片题目待识别",
          correctAnswer: "待教师确认",
          mistakeReason: "图片题干需要教师复核",
          knowledgePoints: ["几何"],
          similarQuestions: ["同类题 1"],
          teacherReviewRequired: true
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "拍照错题",
      studentAnswer: "学生答案待补充",
      imagePath: "/tmp/mistake.jpg"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18080/v1/ai/mistakes/analyze",
      expect.objectContaining({
        body: JSON.stringify({
          studentId: "chen",
          subject: "数学",
          questionText: "拍照错题",
          studentAnswer: "学生答案待补充",
          imagePath: "/tmp/mistake.jpg"
        })
      })
    );
  });

  it("throws when the gateway returns an error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("failed", { status: 500 }));

    await expect(
      analyzeMistake({
        studentId: "chen",
        subject: "数学",
        questionText: "函数图像平移",
        studentAnswer: "向左"
      })
    ).rejects.toThrow("AI analysis failed: 500");
  });

  it("falls back to local analysis when the gateway is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "函数图像平移",
      studentAnswer: "向左"
    });

    expect(result.teacherReviewRequired).toBe(true);
    expect(result.mistakeReason).toContain("本地 AI 演示分析");
    expect(result.knowledgePoints).toContain("数学核心概念");
  });

  it("mentions selected image in local fallback analysis", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "",
      studentAnswer: "学生答案待补充",
      imagePath: "/tmp/mistake.jpg"
    });

    expect(result.questionText).toContain("mistake.jpg");
  });
});
