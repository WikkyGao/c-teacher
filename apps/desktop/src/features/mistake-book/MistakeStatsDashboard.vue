<script setup lang="ts">
import { computed } from "vue";
import { NEmpty } from "naive-ui";
import { useStudentStore } from "../students/studentStore";

const students = useStudentStore();

const stats = computed(() => students.activeStudentMistakeStats);
const records = computed(() => students.activeStudentMistakeRecords);

const subjectChartData = computed(() => {
  const counts = stats.value.subjectCounts;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? entries[0][1] : 1;
  return entries.map(([subject, count]) => ({
    subject,
    count,
    percentage: Math.round((count / max) * 100)
  }));
});

const masteryPercentage = computed(() => {
  if (stats.value.total === 0) return { mastered: 0, pending: 0 };
  return {
    mastered: Math.round((stats.value.mastered / stats.value.total) * 100),
    pending: Math.round((stats.value.pending / stats.value.total) * 100)
  };
});

const recentTrend = computed(() => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const count = records.value.filter((r) => {
      const created = new Date(r.createdAt);
      return (
        created.getFullYear() === date.getFullYear() &&
        created.getMonth() === date.getMonth() &&
        created.getDate() === date.getDate()
      );
    }).length;
    days.push({ date: dateStr, count });
  }
  const max = Math.max(...days.map((d) => d.count), 1);
  return days.map((d) => ({
    ...d,
    height: Math.round((d.count / max) * 100)
  }));
});

const topKnowledgePoints = computed(() => {
  const kpCounts: Record<string, number> = {};
  for (const r of records.value) {
    for (const kp of r.knowledgePoints) {
      kpCounts[kp] = (kpCounts[kp] || 0) + 1;
    }
  }
  return Object.entries(kpCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
});
</script>

<template>
  <div class="mistake-stats-dashboard">
    <div v-if="stats.total === 0" class="stats-empty">
      <n-empty description="暂无数据，录入错题后查看统计" />
    </div>

    <template v-else>
      <!-- 掌握率环形图 -->
      <div class="stat-section">
        <h3>掌握率</h3>
        <div class="mastery-chart">
          <div class="donut-container">
            <svg viewBox="0 0 36 36" class="donut-chart">
              <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#e0e0e0" stroke-width="3" />
              <circle
                cx="18" cy="18" r="15.9"
                fill="transparent"
                stroke="#4caf50"
                stroke-width="3"
                stroke-dasharray="100 100"
                :stroke-dashoffset="100 - masteryPercentage.mastered"
                stroke-linecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div class="donut-center">
              <span class="donut-value">{{ masteryPercentage.mastered }}%</span>
              <span class="donut-label">已掌握</span>
            </div>
          </div>
          <div class="mastery-legend">
            <div class="legend-item">
              <span class="legend-dot" style="background: #4caf50"></span>
              <span>已掌握 {{ stats.mastered }} 题 ({{ masteryPercentage.mastered }}%)</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="background: #ff9800"></span>
              <span>待复习 {{ stats.pending }} 题 ({{ masteryPercentage.pending }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 科目分布柱状图 -->
      <div class="stat-section">
        <h3>科目分布</h3>
        <div class="bar-chart">
          <div v-for="item in subjectChartData" :key="item.subject" class="bar-row">
            <span class="bar-label">{{ item.subject }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: item.percentage + '%' }"></div>
            </div>
            <span class="bar-value">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <!-- 近7天趋势 -->
      <div class="stat-section">
        <h3>近7天新增趋势</h3>
        <div class="trend-chart">
          <div v-for="day in recentTrend" :key="day.date" class="trend-bar">
            <div class="trend-bar-fill" :style="{ height: day.height + '%' }"></div>
            <span class="trend-count">{{ day.count }}</span>
            <span class="trend-date">{{ day.date }}</span>
          </div>
        </div>
      </div>

      <!-- 热门知识点 -->
      <div v-if="topKnowledgePoints.length > 0" class="stat-section">
        <h3>高频错误知识点</h3>
        <div class="kp-list">
          <div v-for="(kp, i) in topKnowledgePoints" :key="kp.name" class="kp-item">
            <span class="kp-rank" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
            <span class="kp-name">{{ kp.name }}</span>
            <span class="kp-count">{{ kp.count }} 次</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mistake-stats-dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-empty {
  padding: 40px 0;
}

.stat-section {
  background: var(--panel-solid);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.stat-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  color: var(--text);
}

.mastery-chart {
  display: flex;
  align-items: center;
  gap: 24px;
}

.donut-container {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.donut-chart {
  width: 100%;
  height: 100%;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.donut-label {
  font-size: 11px;
  color: var(--muted);
}

.mastery-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  width: 60px;
  font-size: 13px;
  color: var(--text);
  text-align: right;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 20px;
  background: var(--surface-soft);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #42a5f5, #1976d2);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.bar-value {
  width: 30px;
  font-size: 13px;
  color: var(--muted);
  text-align: right;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 100px;
  padding-top: 10px;
}

.trend-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.trend-bar-fill {
  width: 100%;
  max-width: 30px;
  background: linear-gradient(180deg, #66bb6a, #43a047);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.3s ease;
}

.trend-count {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.trend-date {
  font-size: 10px;
  color: var(--muted);
}

.kp-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--surface-soft);
  border-radius: 6px;
  font-size: 13px;
}

.kp-rank {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--border);
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.kp-rank.top3 {
  background: #ff9800;
  color: white;
}

.kp-name {
  flex: 1;
  color: var(--text);
}

.kp-count {
  color: var(--muted);
  font-size: 12px;
}
</style>
