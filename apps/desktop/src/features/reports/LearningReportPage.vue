<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useMessage } from "naive-ui";
import { computed, ref } from "vue";
import { useChildStore } from "../children/childStore";
import { createLearningReportMarkdown } from "./reportExport";
import { childLabel } from "../../shared/utils/childLabel";
import type { UserRole } from "../auth/authSession";

const props = defineProps<{ userRole?: UserRole }>();
const cl = computed(() => childLabel(props.userRole));

const workspace = useChildStore();
const message = useMessage();
const selectedChildId = ref(workspace.activeChildId);
const childOptions = computed(() => workspace.items.map((child) => ({ label: child.name, value: child.id })));
const selectedReport = computed(() => {
  return workspace.learningReports.find((report) => report.studentId === selectedChildId.value) ?? workspace.learningReports[0];
});

async function copyReport() {
  if (!selectedReport.value) return;
  if (!navigator.clipboard?.writeText) {
    message.warning("当前环境不支持复制到剪贴板");
    return;
  }

  await navigator.clipboard.writeText(createLearningReportMarkdown(selectedReport.value));
  message.success("学习报告 Markdown 已复制");
}

async function exportReport() {
  if (!selectedReport.value) return;
  if (!isTauri()) {
    message.info("Web 预览环境不能导出文件，请在 Tauri 桌面端使用");
    return;
  }

  const path = await save({
    defaultPath: `${selectedReport.value.studentName}-学习报告.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }]
  });
  if (!path) return;

  try {
    await invoke("write_text_file", {
      path,
      content: createLearningReportMarkdown(selectedReport.value)
    });
    message.success("学习报告已导出");
  } catch (error) {
    message.error(`导出失败：${String(error)}`);
  }
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">学习报告</h1>
        <p class="page-subtitle">基于课程进度、课堂记录、作业和错题本生成阶段复盘摘要</p>
      </div>
      <n-space>
        <n-select v-model:value="selectedChildId" :options="childOptions" class="report-child-select" />
        <n-button secondary @click="copyReport">复制报告</n-button>
        <n-button type="primary" @click="exportReport">导出 Markdown</n-button>
      </n-space>
    </div>

    <div class="dashboard-grid">
      <section v-if="selectedReport" class="side-panel wide-panel">
        <h2>{{ selectedReport.studentName }} · 阶段报告</h2>
        <p>学习目标：{{ selectedReport.goal }}</p>
        <p>学习风格：{{ selectedReport.style }}</p>

        <section class="report-hero">
          <div>
            <strong>{{ selectedReport.averageProgress }}%</strong>
            <span>平均课程进度</span>
          </div>
          <n-progress type="line" :percentage="selectedReport.averageProgress" :show-indicator="false" :height="9" color="var(--primary)" />
        </section>

        <div class="metric-grid compact-metrics">
          <div class="metric-card">
            <strong>{{ selectedReport.classRecordCount }}</strong>
            <span>课堂记录</span>
          </div>
          <div class="metric-card">
            <strong>{{ selectedReport.homeworkCount }}</strong>
            <span>作业条目</span>
          </div>
          <div class="metric-card">
            <strong>{{ selectedReport.pendingGradingCount }}</strong>
            <span>待批改</span>
          </div>
          <div class="metric-card">
            <strong>{{ selectedReport.materialCount }}</strong>
            <span>资料数量</span>
          </div>
        </div>

        <div class="list-row">
          <strong>薄弱点</strong>
          <p>{{ selectedReport.weakPoints.join("、") || "暂无" }}</p>
        </div>

        <div class="list-row">
          <strong>下一步建议</strong>
          <p v-for="action in selectedReport.nextActions" :key="action">{{ action }}</p>
        </div>
      </section>

      <aside class="side-panel">
        <h2>全部{{ cl }}概览</h2>
        <div v-for="report in workspace.learningReports" :key="report.studentId" class="list-row compact-row">
          <strong>{{ report.studentName }} · {{ report.averageProgress }}%</strong>
          <p>{{ report.goal }}</p>
          <n-button size="small" secondary @click="selectedChildId = report.studentId">查看报告</n-button>
        </div>
      </aside>
    </div>
  </div>
</template>
