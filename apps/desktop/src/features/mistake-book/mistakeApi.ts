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

const API_BASE = "http://127.0.0.1:18080";

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

export async function analyzeMistake(input: AnalyzeMistakeInput): Promise<AnalyzeMistakeOutput> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/ai/mistakes/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
  } catch {
    return createLocalAnalysis(input);
  }

  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  return response.json() as Promise<AnalyzeMistakeOutput>;
}
