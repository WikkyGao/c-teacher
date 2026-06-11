import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, chatCompletionStream, testProviderConnection } from "./aiClient";
import type { AiProviderConfig } from "../students/studentStore";

const tauriFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: tauriFetchMock
}));

const provider: AiProviderConfig = {
  id: "provider-path",
  name: "Path Provider",
  baseUrl: "https://api.example.com/anthropic",
  apiKey: "sk-test",
  apiFormat: "openai-chat",
  connectionStatus: "待测试",
  models: [{ id: "model-a", name: "model-a", purpose: "通用", isDefault: true, supportsVision: false }]
};

describe("aiClient endpoint resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("uses the baseUrl directly for endpoint resolution", async () => {
    tauriFetchMock.mockImplementation(async (url) => {
      if (url === "https://api.example.com/anthropic/chat/completions") {
        return new Response(
          JSON.stringify({
            model: "model-a",
            choices: [{ message: { content: "ok" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(testProviderConnection(provider)).resolves.toBe(true);
    await expect(chatCompletion(provider, [{ role: "user", content: "hi" }])).resolves.toMatchObject({
      content: "ok",
      model: "model-a"
    });

    expect(tauriFetchMock).toHaveBeenCalledWith(
      "https://api.example.com/anthropic/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("streams OpenAI chat through the Tauri HTTP adapter", async () => {
    tauriFetchMock.mockResolvedValue(new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\n"));
          controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n\n"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    ));
    const chunks: string[] = [];

    for await (const chunk of chatCompletionStream(provider, [{ role: "user", content: "hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["你", "好"]);
    expect(tauriFetchMock).toHaveBeenCalledWith(
      "https://api.example.com/anthropic/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("serializes image content for OpenAI chat requests", async () => {
    tauriFetchMock.mockResolvedValue(new Response(
      JSON.stringify({
        model: "model-a",
        choices: [{ message: { content: "ok" } }]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));

    await chatCompletion(provider, [
      {
        role: "user",
        content: [
          { type: "text", text: "分析这张错题图片" },
          { type: "image_url", imageUrl: "data:image/png;base64,abc123" }
        ]
      }
    ]);

    const body = JSON.parse(tauriFetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "分析这张错题图片" },
      { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } }
    ]);
  });
});
