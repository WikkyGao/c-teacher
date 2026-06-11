import { isTauri, invoke } from "@tauri-apps/api/core";
import { chatCompletion, chatCompletionStream, getDefaultAiConfig } from "../ai/aiClient";
import type { ChatMessage } from "../ai/aiClient";
import { DEFAULT_SIMILAR_QUESTIONS_PROMPT, useStudentStore } from "../students/studentStore";

export type AnalyzeMistakeInput = {
  studentId: string;
  subject: string;
  questionText: string;
  studentAnswer: string;
  imagePath?: string;
};

export type AnalyzeMistakeOutput = {
  questionText: string;
  correctAnswer: string;
  mistakeReason: string;
  knowledgePoints: string[];
  similarQuestions: string[];
  teacherReviewRequired: boolean;
};

function createLocalAnalysis(input: AnalyzeMistakeInput): AnalyzeMistakeOutput {
  const imageName = input.imagePath?.split(/[\\/]/).filter(Boolean).at(-1);
  return {
    questionText: input.questionText || (imageName ? `图片错题：${imageName}` : "待识别题干"),
    correctAnswer: "待教师确认的参考答案",
    mistakeReason: `本地 AI 演示分析：${input.subject} 题目需要重点核对题干条件、解题步骤和最终答案。`,
    knowledgePoints: [`${input.subject}核心概念`, "题干条件抽取", "规范答题步骤"],
    similarQuestions: ["同知识点基础题 1", "同题型变式题 1", "综合应用题 1"],
    teacherReviewRequired: true
  };
}

async function readMistakeImageDataUrl(imagePath?: string): Promise<string | undefined> {
  if (!imagePath) return undefined;
  if (!isTauri()) return undefined;
  return invoke<string>("read_mistake_image_data_url", { path: imagePath });
}

function userMessage(prompt: string, imageDataUrl?: string): ChatMessage {
  if (!imageDataUrl) return { role: "user", content: prompt };
  return {
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", imageUrl: imageDataUrl }
    ]
  };
}

function getMistakeSystemPrompt(): string {
  try {
    const s = useStudentStore();
    return s.appSettings.mistakeAnalysisPrompt || "你是一位严谨的教学辅导老师，擅长分析学生错题并给出有针对性的建议。";
  } catch {
    return "你是一位严谨的教学辅导老师，擅长分析学生错题并给出有针对性的建议。";
  }
}

function getSimilarQuestionsSystemPrompt(): string {
  try {
    const s = useStudentStore();
    return s.appSettings.similarQuestionsPrompt || DEFAULT_SIMILAR_QUESTIONS_PROMPT;
  } catch {
    return DEFAULT_SIMILAR_QUESTIONS_PROMPT;
  }
}

function buildSimilarQuestionsPrompt(input: AnalyzeMistakeInput): string {
  const template = getSimilarQuestionsSystemPrompt();
  const questionText = input.questionText || (input.imagePath ? `[图片错题：${input.imagePath}]` : "待分析错题");
  const knowledgePoints = input.subject || "通用";
  return template
    .replace(/{{original_question}}/g, questionText)
    .replace(/{{knowledge_points}}/g, knowledgePoints)
    .replace(/{{difficulty_level}}/g, "与原题保持一致")
    .replace(/{{language_instruction}}/g, "")
    .replace(/{{difficulty_instruction}}/g, "")
    .replace(/{{provider_hints}}/g, "");
}

function getRequiredAiConfig() {
  try {
    const config = getDefaultAiConfig();
    if (config) return config;
  } catch {
    // Fall through to the user-facing error below.
  }
  throw new Error("请先在应用设置中配置默认 AI 供应商和模型");
}

function buildPrompt(input: AnalyzeMistakeInput): string {
  const imageInfo = input.imagePath ? `（已上传错题图片：${input.imagePath}）` : "";
  return `你是一位经验丰富的${input.subject}老师。请分析以下学生的错题。

题干：${input.questionText}
学生答案：${input.studentAnswer}
${imageInfo}

请按以下 JSON 格式返回分析结果：
{
  "questionText": "纠正或补充后的完整题干",
  "correctAnswer": "正确的解题过程和答案",
  "mistakeReason": "错误原因分析，说明学生错在哪里",
  "knowledgePoints": ["涉及知识点1", "涉及知识点2"]
}

请确保返回的是纯 JSON，不要包含 markdown 代码块标记。`;
}

function buildReadablePrompt(input: AnalyzeMistakeInput): string {
  const imageInfo = input.imagePath ? `（已上传错题图片：${input.imagePath}）` : "";
  return `你是一位经验丰富的${input.subject}老师。请分析以下学生的错题。

题干：${input.questionText}
学生答案：${input.studentAnswer}
${imageInfo}

请直接输出给老师看的分析内容，不要输出 JSON、代码块、字段引号、花括号或 markdown 表格。
必须按下面 4 个小标题输出，每个小标题独占一行：
题干修正：
参考答案：
错误原因：
知识点：

要求：
- 内容简洁、具体，可直接放在错题本卡片里展示。
- 知识点可以用顿号或分号分隔。
- 不要输出类似题型建议，类似题由单独的"出类似题"功能生成。
- 不要额外解释输出格式。`;
}

function parseAnalyzeMistakeContent(content: string, input: AnalyzeMistakeInput): AnalyzeMistakeOutput {
  try {
    const cleaned = content.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Omit<AnalyzeMistakeOutput, "teacherReviewRequired">;
    return {
      ...parsed,
      questionText: parsed.questionText || input.questionText,
      correctAnswer: parsed.correctAnswer || "待教师确认",
      mistakeReason: parsed.mistakeReason || "AI 分析暂不可用",
      knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints : [],
      similarQuestions: Array.isArray(parsed.similarQuestions) ? parsed.similarQuestions : [],
      teacherReviewRequired: true
    };
  } catch {
    throw new Error("AI 返回内容不是有效的错题分析 JSON");
  }
}

function readSection(content: string, heading: string, nextHeadings: string[]): string {
  const start = content.indexOf(`${heading}：`);
  if (start === -1) return "";
  const bodyStart = start + heading.length + 1;
  const nextIndexes = nextHeadings
    .map((nextHeading) => content.indexOf(`${nextHeading}：`, bodyStart))
    .filter((index) => index >= 0);
  const bodyEnd = nextIndexes.length > 0 ? Math.min(...nextIndexes) : content.length;
  return content.slice(bodyStart, bodyEnd).trim();
}

function splitListText(text: string): string[] {
  return text
    .split(/[\n；;、]/)
    .map((item) => item.replace(/^[-\d.、\s]+/, "").trim())
    .filter(Boolean);
}

function parseReadableAnalyzeMistakeContent(content: string, input: AnalyzeMistakeInput): AnalyzeMistakeOutput {
  const cleaned = content.replace(/```[\s\S]*?```/g, "").trim();
  const headings = ["题干修正", "参考答案", "错误原因", "知识点"];
  const questionText = readSection(cleaned, "题干修正", headings.filter((heading) => heading !== "题干修正"));
  const correctAnswer = readSection(cleaned, "参考答案", headings.filter((heading) => heading !== "参考答案"));
  const mistakeReason = readSection(cleaned, "错误原因", headings.filter((heading) => heading !== "错误原因"));
  const knowledgePoints = splitListText(readSection(cleaned, "知识点", headings.filter((heading) => heading !== "知识点")));

  if (!mistakeReason && knowledgePoints.length === 0) {
    throw new Error("AI 返回内容不是有效的错题分析文本");
  }

  return {
    questionText: questionText || input.questionText,
    correctAnswer: correctAnswer || "待教师确认",
    mistakeReason: mistakeReason || cleaned,
    knowledgePoints,
    similarQuestions: [],
    teacherReviewRequired: true
  };
}

export async function analyzeMistake(input: AnalyzeMistakeInput): Promise<AnalyzeMistakeOutput> {
  const config = getRequiredAiConfig();
  const prompt = buildPrompt(input);
  const imageDataUrl = await readMistakeImageDataUrl(input.imagePath);

  const response = await chatCompletion(config.provider, [
    { role: "system", content: getMistakeSystemPrompt() },
    userMessage(prompt, imageDataUrl)
  ], { model: config.modelName, temperature: 0.3, maxTokens: 1536 });

  return parseAnalyzeMistakeContent(response.content, input);
}

export async function analyzeMistakeStream(
  input: AnalyzeMistakeInput,
  onDelta: (delta: string, fullContent: string) => void
): Promise<AnalyzeMistakeOutput> {
  const config = getRequiredAiConfig();
  const prompt = buildReadablePrompt(input);
  const imageDataUrl = await readMistakeImageDataUrl(input.imagePath);
  let fullContent = "";

  for await (const delta of chatCompletionStream(config.provider, [
    { role: "system", content: getMistakeSystemPrompt() },
    userMessage(prompt, imageDataUrl)
  ], { model: config.modelName, temperature: 0.3, maxTokens: 1536 })) {
    fullContent += delta;
    onDelta(delta, fullContent);
  }

  return parseReadableAnalyzeMistakeContent(fullContent, input);
}

export async function generateSimilarQuestions(input: AnalyzeMistakeInput): Promise<string[]> {
  const config = getRequiredAiConfig();
  const prompt = buildSimilarQuestionsPrompt(input);

  const response = await chatCompletion(config.provider, [
    { role: "system", content: getSimilarQuestionsSystemPrompt() },
    { role: "user", content: prompt }
  ], { model: config.modelName, temperature: 0.7, maxTokens: 1024 });

  try {
    const cleaned = response.content.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { questions: string[] };
    if (Array.isArray(parsed.questions)) return parsed.questions;
  } catch {
    // Fall through to a consistent parse error.
  }
  throw new Error("AI 返回内容不是有效的类似题 JSON");
}

function buildReadableSimilarQuestionsPrompt(input: AnalyzeMistakeInput): string {
  return buildSimilarQuestionsPrompt(input);
}

function cleanDisplayContent(content: string): string {
  return content
    // 去掉 XML/HTML 标签
    .replace(/<\/?[a-zA-Z_][\w-]*>/g, "")
    // 去掉代码块标记
    .replace(/```[\s\S]*?```/g, "")
    .replace(/```/g, "")
    // 去掉 JSON 花括号残余
    .replace(/^\s*[{[\]}]\s*$/gm, "")
    // 去掉转义反斜杠残余
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    // 合并连续空行
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseReadableSimilarQuestions(content: string): string[] {
  const cleaned = cleanDisplayContent(content);
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.、）)])\s*/, "").trim())
    .filter((line) => line.length > 4); // 过滤过短的行
  if (lines.length > 0) return lines;
  throw new Error("AI 返回内容不是有效的类似题文本");
}

export async function generateSimilarQuestionsStream(
  input: AnalyzeMistakeInput,
  onDelta: (delta: string, fullContent: string) => void
): Promise<string[]> {
  const config = getRequiredAiConfig();
  const prompt = buildReadableSimilarQuestionsPrompt(input);
  let rawContent = "";

  for await (const delta of chatCompletionStream(config.provider, [
    { role: "system", content: getSimilarQuestionsSystemPrompt() },
    { role: "user", content: prompt }
  ], { model: config.modelName, temperature: 0.7, maxTokens: 1536 })) {
    rawContent += delta;
    // 实时显示清理后的内容，避免特殊符号闪烁
    onDelta(delta, cleanDisplayContent(rawContent));
  }

  return parseReadableSimilarQuestions(rawContent);
}
