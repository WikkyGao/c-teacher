import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMistake, analyzeMistakeStream, generateSimilarQuestionsStream } from "./mistakeApi";
import { chatCompletion, chatCompletionStream, getDefaultAiConfig } from "../ai/aiClient";

vi.mock("../ai/aiClient", () => ({
  chatCompletion: vi.fn(),
  chatCompletionStream: vi.fn(),
  getDefaultAiConfig: vi.fn()
}));

const mockedChatCompletion = vi.mocked(chatCompletion);
const mockedChatCompletionStream = vi.mocked(chatCompletionStream);
const mockedGetDefaultAiConfig = vi.mocked(getDefaultAiConfig);

const configuredProvider = {
  id: "provider-test",
  name: "测试供应商",
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-test",
  apiFormat: "openai-chat" as const,
  models: [{ id: "model-test", name: "model-test", purpose: "通用", isDefault: true }]
};

describe("analyzeMistake", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("rejects analysis when no AI provider is configured", async () => {
    mockedGetDefaultAiConfig.mockReturnValue(null);

    await expect(analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "函数图像平移",
      studentAnswer: "向左"
    })).rejects.toThrow("请先在应用设置中配置默认 AI 供应商和模型");
  });

  it("rejects analysis when the configured AI request fails", async () => {
    mockedGetDefaultAiConfig.mockReturnValue({ provider: configuredProvider, modelName: "model-test" });
    mockedChatCompletion.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "函数图像平移",
      studentAnswer: "向左"
    })).rejects.toThrow("Failed to fetch");
  });

  it("rejects analysis when AI returns invalid JSON", async () => {
    mockedGetDefaultAiConfig.mockReturnValue({ provider: configuredProvider, modelName: "model-test" });
    mockedChatCompletion.mockResolvedValue({
      model: "model-test",
      content: "这不是 JSON"
    });

    await expect(analyzeMistake({
      studentId: "chen",
      subject: "物理",
      questionText: "自由落体",
      studentAnswer: "v=gt"
    })).rejects.toThrow("AI 返回内容不是有效的错题分析 JSON");
  });

  it("uses the configured AI model and sends the entered mistake content", async () => {
    mockedGetDefaultAiConfig.mockReturnValue({ provider: configuredProvider, modelName: "model-test" });
    mockedChatCompletion.mockResolvedValue({
      model: "model-test",
      content: JSON.stringify({
        questionText: "一次函数图像向右平移 2 个单位",
        correctAnswer: "应将 x 替换为 x-2",
        mistakeReason: "学生把左右平移方向记反了",
        knowledgePoints: ["一次函数图像平移"],
        similarQuestions: ["将 y=2x+1 向左平移 3 个单位"]
      })
    });

    const result = await analyzeMistake({
      studentId: "chen",
      subject: "数学",
      questionText: "一次函数图像向右平移 2 个单位",
      studentAnswer: "把 x 替换为 x+2"
    });

    expect(result.mistakeReason).toBe("学生把左右平移方向记反了");
    expect(mockedChatCompletion).toHaveBeenCalledWith(
      configuredProvider,
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("一次函数图像向右平移 2 个单位")
        })
      ]),
      expect.objectContaining({ model: "model-test" })
    );
    expect(mockedChatCompletion.mock.calls[0][1][1].content).toContain("把 x 替换为 x+2");
  });

  it("streams readable AI output before returning parsed analysis", async () => {
    mockedGetDefaultAiConfig.mockReturnValue({ provider: configuredProvider, modelName: "model-test" });
    mockedChatCompletionStream.mockImplementation(async function* () {
      yield "题干修正：函数题\n";
      yield "参考答案：x-2\n";
      yield "错误原因：平移方向记反\n";
      yield "知识点：函数平移、图像变换\n";
      yield "类似题：同类题 1；同类题 2";
    });
    const chunks: string[] = [];

    const result = await analyzeMistakeStream({
      studentId: "chen",
      subject: "数学",
      questionText: "函数题",
      studentAnswer: "x+2"
    }, (_delta, fullContent) => {
      chunks.push(fullContent);
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("题干修正");
    expect(chunks.at(-1)).toContain("类似题");
    expect(chunks.at(-1)).not.toContain("\"mistakeReason\"");
    expect(result.mistakeReason).toBe("平移方向记反");
    expect(result.knowledgePoints).toEqual(["函数平移", "图像变换"]);
  });

  it("streams readable similar questions before returning parsed questions", async () => {
    mockedGetDefaultAiConfig.mockReturnValue({ provider: configuredProvider, modelName: "model-test" });
    mockedChatCompletionStream.mockImplementation(async function* () {
      yield "1. 已知一次函数 y=2x+1，";
      yield "将图像向右平移 2 个单位，求新函数解析式。\n";
      yield "2. 将 y=-x+3 向左平移 1 个单位，求新函数解析式。";
    });
    const chunks: string[] = [];

    const questions = await generateSimilarQuestionsStream({
      studentId: "chen",
      subject: "数学",
      questionText: "函数图像平移",
      studentAnswer: "x+2"
    }, (_delta, fullContent) => {
      chunks.push(fullContent);
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)).not.toContain("\"questions\"");
    expect(questions).toEqual([
      "已知一次函数 y=2x+1，将图像向右平移 2 个单位，求新函数解析式。",
      "将 y=-x+3 向左平移 1 个单位，求新函数解析式。"
    ]);
  });
});
