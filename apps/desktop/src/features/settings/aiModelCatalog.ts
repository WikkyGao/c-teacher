import type { AiModelConfig, AiProviderConfig } from "../students/studentStore";

export type FetchedAiModel = {
  name: string;
};

export function getModelCatalogEndpoints(rawBaseUrl: string): string[] {
  const cleaned = rawBaseUrl.trim().replace(/\/+$/, "");
  let hostRoot: string;
  try {
    const parsed = new URL(cleaned);
    hostRoot = `${parsed.protocol}//${parsed.host}`;
  } catch {
    hostRoot = "";
  }

  const candidates: string[] = [];

  // 根据用户填的格式生成候选端点
  if (cleaned.endsWith("/api/v1")) {
    candidates.push(`${cleaned}/models`);                          // https://.../api/v1/models
    if (hostRoot) candidates.push(`${hostRoot}/api/v1/models`);
  }
  if (cleaned.endsWith("/v1")) {
    candidates.push(`${cleaned}/models`);                          // /v1/models
    if (hostRoot) candidates.push(`${hostRoot}/v1/models`);
  }

  // 通用候选
  if (hostRoot) {
    candidates.push(`${hostRoot}/api/v1/models`);
    candidates.push(`${hostRoot}/v1/models`);
    candidates.push(`${hostRoot}/models`);
  }

  // 兜底：直接后缀拼接
  const base = cleaned.replace(/\/v1\/?$/, "").replace(/\/api\/v1\/?$/, "");
  candidates.push(`${base}/v1/models`);
  candidates.push(`${base}/api/v1/models`);
  candidates.push(`${base}/models`);

  return [...new Set(candidates)].filter(Boolean);
}

export async function fetchProviderModels(provider: Pick<AiProviderConfig, "baseUrl" | "apiKey">): Promise<FetchedAiModel[]> {
  const endpoints = getModelCatalogEndpoints(provider.baseUrl);
  let lastError = "";

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        lastError = `(${url}) ${response.status} ${response.statusText}`;
        continue;
      }
      const data = await response.json();
      const rawModels = data.data ?? data.models ?? [];
      return (Array.isArray(rawModels) ? rawModels : [rawModels])
        .map((model: Record<string, unknown>) => {
          const name = (typeof model.id === "string" && model.id) ||
                       (typeof model.name === "string" && model.name) ||
                       "";
          return name;
        })
        .filter(Boolean)
        .map((name: string) => ({ name }));
    } catch (fetchErr) {
      lastError = `${url} 不可达 (${String(fetchErr).slice(0, 50)})`;
    }
  }

  throw new Error(lastError || "模型列表接口不可用");
}

export function mergeFetchedModels(existingModels: AiModelConfig[], fetchedModels: FetchedAiModel[]): AiModelConfig[] {
  const existingNames = new Set(existingModels.map((model) => model.name));
  const merged = [...existingModels];

  for (const model of fetchedModels) {
    if (!existingNames.has(model.name)) {
      merged.push({
        id: "",
        name: model.name,
        purpose: "通用",
        isDefault: false
      });
      existingNames.add(model.name);
    }
  }

  if (!merged.some((model) => model.isDefault) && merged.length > 0) {
    merged[0] = { ...merged[0], isDefault: true };
  }

  return merged;
}
