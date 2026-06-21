import type { AiModelConfig, AiProviderConfig } from "../children/childStore";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

async function httpFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await tauriFetch(url, init);
  } catch {
    return globalThis.fetch(url, init);
  }
}

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

  // 优先：根据用户填的 baseUrl 精确拼接
  if (cleaned.endsWith("/v1") || cleaned.endsWith("/api/v1")) {
    candidates.push(`${cleaned}/models`);
  } else {
    // 未包含版本路径时尝试常见模式
    candidates.push(`${cleaned}/v1/models`);
    candidates.push(`${cleaned}/api/v1/models`);
  }

  // 补充 hostRoot 变体（处理反向代理等场景）
  if (hostRoot) {
    candidates.push(`${hostRoot}/v1/models`);
    candidates.push(`${hostRoot}/api/v1/models`);
  }

  // 部分自部署 NIM 把模型列表放在 /models（无 v1 前缀）
  if (hostRoot) {
    candidates.push(`${hostRoot}/models`);
  }

  return [...new Set(candidates)].filter(Boolean);
}

export async function fetchProviderModels(provider: Pick<AiProviderConfig, "baseUrl" | "apiKey">): Promise<FetchedAiModel[]> {
  const endpoints = getModelCatalogEndpoints(provider.baseUrl);
  const errors: string[] = [];

  for (const url of endpoints) {
    try {
      const response = await httpFetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        errors.push(`${url} → HTTP ${response.status}`);
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
      const msg = String(fetchErr);
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        errors.push(`${url} → 网络不可达（可能被 CORS 或防火墙拦截）`);
      } else {
        errors.push(`${url} → ${msg.slice(0, 80)}`);
      }
    }
  }

  throw new Error(errors.join("\n") || "模型列表接口不可用");
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
        isDefault: false,
        supportsVision: false
      });
      existingNames.add(model.name);
    }
  }

  if (!merged.some((model) => model.isDefault) && merged.length > 0) {
    merged[0] = { ...merged[0], isDefault: true };
  }

  return merged;
}
