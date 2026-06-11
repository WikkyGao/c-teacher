import type { AiApiFormat, AiProviderConfig } from "../students/studentStore";
import { useStudentStore } from "../students/studentStore";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

async function httpFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await tauriFetch(url, init);
  } catch {
    return globalThis.fetch(url, init);
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
};

export type ChatMessageContent = string | ChatMessageContentPart[];

export type ChatMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: string };

export type ChatCompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};

export type ChatCompletionResponse = {
  content: string;
  model: string;
};

/**
 * 调用 AI 接口，根据 apiFormat 选择对应的请求格式。
 */
export async function chatCompletion(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  switch (provider.apiFormat) {
    case "openai-chat":
    case "nvidia":
      return chatOpenAiChat(provider, messages, options);
    case "openai-responses":
      return chatOpenAiResponses(provider, messages, options);
    case "anthropic-messages":
      return chatAnthropic(provider, messages, options);
    default:
      return chatOpenAiChat(provider, messages, options);
  }
}

/**
 * OpenAI Chat Completions API
 * POST /v1/chat/completions
 */
async function chatOpenAiChat(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  const response = await httpFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify({
      model,
      messages: messages.map((message) => ({
        ...message,
        content: toOpenAiChatContent(message.content)
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048
    })
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model: data.model ?? model
  };
}

/**
 * OpenAI Responses API
 * POST /responses
 */
async function chatOpenAiResponses(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  const response = await httpFetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify({
      model,
      input: messages.map((m) => ({
        role: m.role,
        content: toOpenAiResponsesContent(m.content)
      })),
      temperature: options.temperature ?? 0.7,
      max_output_tokens: options.maxTokens ?? 2048
    })
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();
  return {
    content: data.output?.[0]?.content?.[0]?.text ?? "",
    model: data.model ?? model
  };
}

/**
 * Anthropic Messages API
 * POST /messages
 */
async function chatAnthropic(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  // Anthropic 用 "user" / "assistant"，没有 "system" role，转换为 user 消息前缀
  const systemMsg = messages.filter((m) => m.role === "system").map((m) => contentText(m.content)).join("\n");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: toAnthropicContent(m.content) }));

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7
  };

  if (systemMsg) {
    body.system = systemMsg;
  }

  const response = await httpFetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text ?? "",
    model: data.model ?? model
  };
}

/**
 * 流式调用 AI 接口，根据 apiFormat 选择对应格式。
 */
export async function* chatCompletionStream(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  switch (provider.apiFormat) {
    case "openai-chat":
    case "nvidia":
      yield* streamOpenAiChat(provider, messages, options);
      return;
    case "openai-responses":
      yield* streamOpenAiResponses(provider, messages, options);
      return;
    case "anthropic-messages":
      yield* streamAnthropic(provider, messages, options);
      return;
    default:
      yield* streamOpenAiChat(provider, messages, options);
  }
}

async function* streamOpenAiChat(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  const response = await httpFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify({
      model,
      messages: messages.map((message) => ({
        ...message,
        content: toOpenAiChatContent(message.content)
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true
    })
  });

  if (!response.ok) throw await apiError(response);
  yield* parseSSE(response);
}

async function* streamOpenAiResponses(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  const response = await httpFetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: authHeaders(provider),
    body: JSON.stringify({
      model,
      input: messages.map((m) => ({ role: m.role, content: toOpenAiResponsesContent(m.content) })),
      temperature: options.temperature ?? 0.7,
      max_output_tokens: options.maxTokens ?? 2048,
      stream: true
    })
  });

  if (!response.ok) throw await apiError(response);
  yield* parseSSE(response, (parsed: Record<string, unknown>) => {
    // Responses API SSE: type: "response.output_text.delta" → delta
    const d = parsed.delta as string | undefined;
    if (d) return d;
    if (parsed.type === "response.output_text.delta") return parsed.text as string | undefined;
    return undefined;
  });
}

async function* streamAnthropic(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const model = resolveModel(provider, options.model);

  const systemMsg = messages.filter((m) => m.role === "system").map((m) => contentText(m.content)).join("\n");
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: toAnthropicContent(m.content) }));

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    stream: true
  };

  if (systemMsg) body.system = systemMsg;

  const response = await httpFetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw await apiError(response);

  // Anthropic SSE: event: content_block_delta → data: { delta: { text: "..." } }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("响应不支持流式读取");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          if (currentEvent === "content_block_delta") {
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());
              if (parsed.delta?.text) yield parsed.delta.text;
            } catch { /* skip */ }
          }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 测试供应商连接。
 * 根据 apiFormat 选择对应的测试方式。
 */
export async function testProviderConnection(provider: AiProviderConfig): Promise<boolean> {
  const rootUrl = normalizeBaseUrl(provider.baseUrl);
  const model = provider.models.find((m) => m.isDefault)?.name ?? provider.models[0]?.name;
  if (!model) return false;
  const messages = [{ role: "user" as const, content: "hi" }];
  const timeout = AbortSignal.timeout(10000);

  try {
    const { apiFormat, apiKey } = provider;

    if (apiFormat === "anthropic-messages") {
      const resp = await httpFetch(`${rootUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages
        }),
        signal: timeout
      });
      return resp.ok;
    }

    if (apiFormat === "openai-responses") {
      const resp = await httpFetch(`${rootUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: messages,
          max_output_tokens: 10
        }),
        signal: timeout
      });
      return resp.ok;
    }

    // openai-chat / nvidia / default
    const resp = await httpFetch(`${rootUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 10
      }),
      signal: timeout
    });
    return resp.ok;
  } catch (err) {
    console.warn("testProviderConnection failed:", err);
    return false;
  }
}

/**
 * 获取默认供应商和模型配置。
 */
export function getDefaultAiConfig(store?: ReturnType<typeof useStudentStore>): { provider: AiProviderConfig; modelName: string } | null {
  const s = store ?? useStudentStore();
  const providerId = s.appSettings.defaultAiProviderId;
  const modelId = s.appSettings.defaultAiModelId;

  const provider = s.appSettings.aiProviders.find((p) => p.id === providerId);
  if (!provider?.apiKey.trim()) return null;

  const model = provider.models.find((m) => m.id === modelId) ?? provider.models[0];
  if (!model) return null;

  return { provider, modelName: model.name };
}

// --- 内部帮助函数 ---

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function resolveModel(provider: AiProviderConfig, model?: string): string {
  const m = model ?? provider.models.find((m) => m.isDefault)?.name ?? provider.models[0]?.name;
  if (!m) throw new Error(`供应商 "${provider.name}" 未配置任何模型`);
  return m;
}

function authHeaders(provider: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  return headers;
}

function contentText(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function toOpenAiChatContent(content: ChatMessageContent) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "image_url") {
      return { type: "image_url", image_url: { url: part.imageUrl } };
    }
    return part;
  });
}

function toOpenAiResponsesContent(content: ChatMessageContent) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "image_url") {
      return { type: "input_image", image_url: part.imageUrl };
    }
    return { type: "input_text", text: part.text };
  });
}

function toAnthropicContent(content: ChatMessageContent) {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "image_url") {
      const match = part.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return { type: "text", text: "[图片数据格式无效]" };
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: match[1],
          data: match[2]
        }
      };
    }
    return part;
  });
}

async function apiError(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "");
  return new Error(`AI 请求失败 (${response.status}): ${text || response.statusText}`);
}

async function* parseSSE(response: Response, extract?: (parsed: Record<string, unknown>) => string | undefined): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("响应不支持流式读取");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          if (extract) {
            const text = extract(parsed);
            if (text) yield text;
          } else {
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
