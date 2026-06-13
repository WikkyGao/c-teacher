import { isTauri, invoke } from "@tauri-apps/api/core";
import type { MistakeRecord } from "../students/studentStore";

export type ExportOptions = {
  includeAnswer: boolean;
  includeAnalysis: boolean;
  includeKnowledgePoints: boolean;
  includeImage: boolean;
  imageScale: number;
};

const DEFAULT_OPTIONS: ExportOptions = {
  includeAnswer: true,
  includeAnalysis: true,
  includeKnowledgePoints: true,
  includeImage: true,
  imageScale: 80
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function generateRecordHtml(record: MistakeRecord, options: ExportOptions): string {
  let html = `
    <div class="mistake-item">
      <div class="item-header">
        <span class="item-subject">${escapeHtml(record.subject)}</span>
        <span class="item-difficulty">${record.difficulty}</span>
        <span class="item-status ${record.masteryStatus === '已掌握' ? 'mastered' : 'pending'}">${record.masteryStatus}</span>
        <span class="item-date">${formatDate(record.createdAt)}</span>
      </div>
      <div class="item-question">
        <strong>题干：</strong>${escapeHtml(record.questionText || "（图片题）")}
      </div>`;

  if (options.includeImage && record.imagePath) {
    html += `
      <div class="item-image">
        <img src="" data-image-id="${record.id}" data-image-path="${escapeHtml(record.imagePath)}" style="max-width: ${options.imageScale}%; height: auto;" alt="错题图片" />
      </div>`;
  }

  if (options.includeAnswer) {
    html += `
      <div class="item-answer">
        <strong>参考答案：</strong>${escapeHtml(record.correctAnswer || "待教师确认")}
      </div>`;
  }

  if (options.includeAnalysis) {
    html += `
      <div class="item-analysis">
        <strong>错误原因：</strong>${escapeHtml(record.mistakeReason || "暂无")}
      </div>`;
  }

  if (options.includeKnowledgePoints && record.knowledgePoints.length > 0) {
    html += `
      <div class="item-tags">
        <strong>知识点：</strong>${record.knowledgePoints.map((kp) => `<span class="tag">${escapeHtml(kp)}</span>`).join(" ")}
      </div>`;
  }

  if (record.similarQuestions && record.similarQuestions.length > 0) {
    html += `
      <div class="item-similar">
        <strong>类似题：</strong>
        <ol>${record.similarQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ol>
      </div>`;
  }

  html += `</div>`;
  return html;
}

function generatePrintHtml(records: MistakeRecord[], studentName: string, options: ExportOptions): string {
  const recordHtml = records.map((r) => generateRecordHtml(r, options)).join("\n");
  const countText = `共 ${records.length} 题`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${studentName} - 错题本</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; color: #333; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 22px; margin-bottom: 6px; }
    .header p { font-size: 14px; color: #666; }
    .mistake-item { page-break-inside: avoid; margin-bottom: 20px; padding: 14px; border: 1px solid #ddd; border-radius: 8px; }
    .item-header { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 12px; color: #888; }
    .item-subject { font-weight: 600; color: #333; }
    .item-difficulty { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; }
    .item-status.mastered { background: #e8f5e9; color: #388e3c; padding: 2px 8px; border-radius: 4px; }
    .item-status.pending { background: #fff3e0; color: #f57c00; padding: 2px 8px; border-radius: 4px; }
    .item-date { margin-left: auto; }
    .item-question { font-size: 14px; line-height: 1.6; margin-bottom: 10px; }
    .item-image { margin: 10px 0; text-align: center; }
    .item-image img { max-width: 100%; border: 1px solid #eee; border-radius: 4px; }
    .item-answer, .item-analysis { font-size: 13px; line-height: 1.6; margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; }
    .item-tags { font-size: 13px; margin-bottom: 8px; }
    .tag { display: inline-block; background: #e8eaf6; color: #3f51b5; padding: 2px 8px; border-radius: 4px; margin: 2px 4px 2px 0; font-size: 12px; }
    .item-similar { font-size: 13px; line-height: 1.6; }
    .item-similar ol { margin-left: 20px; margin-top: 4px; }
    .item-similar li { margin-bottom: 4px; }
    @media print {
      body { padding: 0; }
      .mistake-item { border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(studentName)} · 错题本</h1>
    <p>${countText} | 导出时间：${new Date().toLocaleString("zh-CN")}</p>
  </div>
  ${recordHtml}
</body>
</html>`;
}

async function loadImageDataUrls(html: string, records: MistakeRecord[]): Promise<string> {
  if (!isTauri()) return html;

  let result = html;
  for (const record of records) {
    if (!record.imagePath) continue;
    try {
      const dataUrl = await invoke<string>("read_mistake_image_data_url", { path: record.imagePath });
      result = result.replace(
        `data-image-id="${record.id}"`,
        `data-image-id="${record.id}" src="${dataUrl}"`
      );
    } catch {
      // 图片加载失败不阻塞
    }
  }
  return result;
}

export async function exportMistakesToPrint(
  records: MistakeRecord[],
  studentName: string,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let html = generatePrintHtml(records, studentName, opts);

  // 预加载图片 data URL
  html = await loadImageDataUrls(html, records);

  // 使用隐藏 iframe 实现打印（Tauri WebView 不支持 window.open）
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("无法创建打印文档");
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // 等待内容渲染
  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    iframe.contentWindow?.print();
  } finally {
    // 延迟移除 iframe，避免打印窗口关闭前 DOM 被删
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }
}

export async function exportMistakesToHtml(
  records: MistakeRecord[],
  studentName: string,
  options: Partial<ExportOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return generatePrintHtml(records, studentName, opts);
}
