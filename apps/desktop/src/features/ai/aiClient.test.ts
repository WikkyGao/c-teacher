import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, testProviderConnection } from "./aiClient";
import type { AiProviderConfig } from "../students/studentStore";

const provider: AiProviderConfig = {
  id: "provider-path",
  name: "Path Provider",
  baseUrl: "https://api.example.com/anthropic",
  apiKey: "sk-test",
  apiFormat: "openai-chat",
  connectionStatus: "待测试",
  models: [{ id: "model-a", name: "model-a", purpose: "通用", isDefault: true }]
};

describe("aiClient endpoint resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the baseUrl directly for endpoint resolution", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
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

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/anthropic/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });
});
