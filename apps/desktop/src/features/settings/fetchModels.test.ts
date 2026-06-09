import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProviderModels, getModelCatalogEndpoints, mergeFetchedModels } from "./aiModelCatalog";

describe("aiModelCatalog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds model endpoints from provider base urls", () => {
    const r1 = getModelCatalogEndpoints("https://api.openai.com/v1");
    expect(r1).toContain("https://api.openai.com/v1/models");
    const r2 = getModelCatalogEndpoints("https://api.deepseek.com/anthropic");
    expect(r2).toContain("https://api.deepseek.com/v1/models");
    const r3 = getModelCatalogEndpoints("https://openrouter.ai");
    expect(r3).toContain("https://openrouter.ai/api/v1/models");
    const r4 = getModelCatalogEndpoints("https://openrouter.ai/api/v1");
    expect(r4).toContain("https://openrouter.ai/api/v1/models");
  });

  it("fetches provider models from the first working endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "deepseek-chat" }, { id: "deepseek-coder" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const models = await fetchProviderModels({
      baseUrl: "https://api.deepseek.com/anthropic",
      apiKey: "sk-real-key"
    });

    expect(models).toEqual([{ name: "deepseek-chat" }, { name: "deepseek-coder" }]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/api/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-real-key"
        })
      })
    );
  });

  it("falls back to the second endpoint when /v1/models fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ models: [{ name: "local-model" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    await expect(fetchProviderModels({ baseUrl: "https://api.example.com/v1", apiKey: "sk-key" })).resolves.toEqual([
      { name: "local-model" }
    ]);
  });

  it("merges fetched models and keeps the current default", () => {
    const merged = mergeFetchedModels(
      [
        { id: "model-a", name: "deepseek-chat", purpose: "通用", isDefault: true },
        { id: "model-b", name: "manual-model", purpose: "报告生成", isDefault: false }
      ],
      [{ name: "deepseek-chat" }, { name: "deepseek-coder" }, { name: "new-model" }]
    );

    expect(merged.map((model) => model.name)).toEqual(["deepseek-chat", "manual-model", "deepseek-coder", "new-model"]);
    expect(merged[0].isDefault).toBe(true);
  });

  it("selects the first fetched model as default when none exists", () => {
    const merged = mergeFetchedModels([], [{ name: "model-a" }]);

    expect(merged).toEqual([{ id: "", name: "model-a", purpose: "通用", isDefault: true }]);
  });
});
