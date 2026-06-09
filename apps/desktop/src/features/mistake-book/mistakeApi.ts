import { chatCompletion, chatCompletionStream, getDefaultAiConfig } from "../ai/aiClient";

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
  "knowledgePoints": ["涉及知识点1", "涉及知识点2"],
  "similarQuestions": ["类似题型建议1", "类似题型建议2"]
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
必须按下面 5 个小标题输出，每个小标题独占一行：
题干修正：
参考答案：
错误原因：
知识点：
类似题：

要求：
- 内容简洁、具体，可直接放在错题本卡片里展示。
- 知识点和类似题可以用顿号或分号分隔。
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
  const headings = ["题干修正", "参考答案", "错误原因", "知识点", "类似题"];
  const questionText = readSection(cleaned, "题干修正", headings.filter((heading) => heading !== "题干修正"));
  const correctAnswer = readSection(cleaned, "参考答案", headings.filter((heading) => heading !== "参考答案"));
  const mistakeReason = readSection(cleaned, "错误原因", headings.filter((heading) => heading !== "错误原因"));
  const knowledgePoints = splitListText(readSection(cleaned, "知识点", headings.filter((heading) => heading !== "知识点")));
  const similarQuestions = splitListText(readSection(cleaned, "类似题", headings.filter((heading) => heading !== "类似题")));

  if (!mistakeReason && knowledgePoints.length === 0 && similarQuestions.length === 0) {
    throw new Error("AI 返回内容不是有效的错题分析文本");
  }

  return {
    questionText: questionText || input.questionText,
    correctAnswer: correctAnswer || "待教师确认",
    mistakeReason: mistakeReason || cleaned,
    knowledgePoints,
    similarQuestions,
    teacherReviewRequired: true
  };
}

export async function analyzeMistake(input: AnalyzeMistakeInput): Promise<AnalyzeMistakeOutput> {
  const config = getRequiredAiConfig();
  const prompt = buildPrompt(input);

  const response = await chatCompletion(config.provider, [
    { role: "system", content: "你是一位严谨的教学辅导老师，擅长分析学生错题并给出有针对性的建议。请严格按照要求的 JSON 格式返回。" },
    { role: "user", content: prompt }
  ], { model: config.modelName, temperature: 0.3, maxTokens: 1536 });

  return parseAnalyzeMistakeContent(response.content, input);
}

export async function analyzeMistakeStream(
  input: AnalyzeMistakeInput,
  onDelta: (delta: string, fullContent: string) => void
): Promise<AnalyzeMistakeOutput> {
  const config = getRequiredAiConfig();
  const prompt = buildReadablePrompt(input);
  let fullContent = "";

  for await (const delta of chatCompletionStream(config.provider, [
    { role: "system", content: "你是一位严谨的教学辅导老师，擅长分析学生错题并给出有针对性的建议。请输出给老师直接阅读的自然语言分析，不要输出 JSON 或代码块。" },
    { role: "user", content: prompt }
  ], { model: config.modelName, temperature: 0.3, maxTokens: 1536 })) {
    fullContent += delta;
    onDelta(delta, fullContent);
  }

  return parseReadableAnalyzeMistakeContent(fullContent, input);
}

export async function generateSimilarQuestions(input: AnalyzeMistakeInput): Promise<string[]> {
  const config = getRequiredAiConfig();
  const prompt = `你是一位经验丰富的${input.subject}老师。基于以下错题，生成 3 道针对性的类似练习题，帮助学生巩固薄弱知识点。

错题题干：${input.questionText}
${input.studentAnswer ? `学生答案：${input.studentAnswer}` : ""}

请按以下 JSON 格式返回，不要包含 markdown 代码块标记：
{
  "questions": ["练习题1", "练习题2", "练习题3"]
}`;

  const response = await chatCompletion(config.provider, [
    { role: "system", content: "你是一位严谨的教学辅导老师。" },
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
  return `你是一位经验丰富的${input.subject}老师。基于以下错题，生成 3 道针对性的类似练习题，帮助学生巩固薄弱知识点。

错题题干：${input.questionText}
${input.studentAnswer ? `学生答案：${input.studentAnswer}` : ""}

请直接输出给老师看的类似题，不要输出 JSON、代码块、字段引号、花括号或 markdown 表格。
格式要求：
1. 第一题
2. 第二题
3. 第三题

每题应包含完整题干，必要时给出简短作答要求。不要额外解释输出格式。`;
}

function parseReadableSimilarQuestions(content: string): string[] {
  const cleaned = content.replace(/```[\s\S]*?```/g, "").trim();
  const questions = cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.、）)])\s*/, "").trim())
    .filter(Boolean);
  if (questions.length > 0) return questions;
  throw new Error("AI 返回内容不是有效的类似题文本");
}

export async function generateSimilarQuestionsStream(
  input: AnalyzeMistakeInput,
  onDelta: (delta: string, fullContent: string) => void
): Promise<string[]> {
  const config = getRequiredAiConfig();
  const prompt = buildReadableSimilarQuestionsPrompt(input);
  let fullContent = "";

  for await (const delta of chatCompletionStream(config.provider, [
    { role: "system", content: "你是一位严谨的教学辅导老师。请输出给老师直接阅读的类似题列表，不要输出 JSON 或代码块。" },
    { role: "user", content: prompt }
  ], { model: config.modelName, temperature: 0.7, maxTokens: 1024 })) {
    fullContent += delta;
    onDelta(delta, fullContent);
  }

  return parseReadableSimilarQuestions(fullContent);
}
