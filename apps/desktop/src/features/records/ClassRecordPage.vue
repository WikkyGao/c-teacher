<script setup lang="ts">
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { ClassRecord, GradingStatus } from "../students/studentStore";
import { useStudentStore } from "../students/studentStore";

const workspace = useStudentStore();
const message = useMessage();
const editingRecordId = ref<string | null>(null);
const formTitle = computed(() => (editingRecordId.value ? "编辑课堂记录" : "新建课堂记录"));
const form = reactive({
  studentId: workspace.activeStudentId,
  subject: workspace.activeStudent.courses[0]?.subject ?? "数学",
  lessonContent: "函数图像与性质",
  performance: "课堂参与积极，图像变换仍需练习",
  homework: "练习 A 组第 1-8 题"
});
const studentOptions = computed(() => {
  return workspace.items.map((student) => ({ label: student.name, value: student.id }));
});

function resetForm() {
  editingRecordId.value = null;
  form.studentId = workspace.activeStudentId;
  form.subject = workspace.activeStudent.courses[0]?.subject ?? "数学";
  form.lessonContent = "";
  form.performance = "";
  form.homework = "";
}

function editRecord(record: ClassRecord) {
  editingRecordId.value = record.id;
  form.studentId = record.studentId;
  form.subject = record.subject;
  form.lessonContent = record.lessonContent;
  form.performance = record.performance;
  form.homework = record.homework;
}

function saveRecord() {
  if (!form.studentId || !form.lessonContent.trim()) {
    message.warning("请选择学生并填写授课内容");
    return;
  }
  const draft = {
    studentId: form.studentId,
    subject: form.subject.trim() || "未分类",
    lessonContent: form.lessonContent.trim(),
    performance: form.performance.trim(),
    homework: form.homework.trim()
  };
  if (editingRecordId.value) {
    workspace.updateClassRecord(editingRecordId.value, draft);
    editingRecordId.value = null;
    message.success("课堂记录已更新");
  } else {
    workspace.createClassRecord(draft);
    message.success("课堂记录已保存");
  }
}

function studentName(studentId: string) {
  return workspace.items.find((student) => student.id === studentId)?.name ?? studentId;
}

function updateGradingStatus(recordId: string, status: GradingStatus) {
  const updated = workspace.updateHomeworkGradingStatus(recordId, status);
  message[updated ? "success" : "warning"](updated ? "批改状态已更新" : "这条记录没有可批改作业");
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">课堂记录</h1>
        <p class="page-subtitle">记录授课内容、学生表现和作业布置</p>
      </div>
    </div>

    <div class="dashboard-grid">
      <n-card :title="formTitle">
        <n-form label-placement="top">
          <n-form-item label="学生">
            <n-select v-model:value="form.studentId" :options="studentOptions" />
          </n-form-item>
          <n-form-item label="科目">
            <n-input v-model:value="form.subject" />
          </n-form-item>
          <n-form-item label="授课内容">
            <n-input v-model:value="form.lessonContent" type="textarea" />
          </n-form-item>
          <n-form-item label="学生表现">
            <n-input v-model:value="form.performance" type="textarea" />
          </n-form-item>
          <n-form-item label="作业布置">
            <n-input v-model:value="form.homework" />
          </n-form-item>
          <n-space>
            <n-button type="primary" @click="saveRecord">{{ editingRecordId ? "更新课堂记录" : "保存课堂记录" }}</n-button>
            <n-button v-if="editingRecordId" secondary @click="resetForm">取消编辑</n-button>
          </n-space>
        </n-form>
      </n-card>

      <aside class="side-panel">
        <h2>关联资料与历史记录</h2>
        <p v-for="material in workspace.materials.slice(0, 3)" :key="material.id">{{ material.title }}</p>
        <div v-for="record in workspace.classRecords" :key="record.id" class="list-row compact-row">
          <strong>{{ studentName(record.studentId) }} · {{ record.subject }}</strong>
          <p>{{ record.lessonContent }}</p>
          <p>作业：{{ record.homework || "未布置" }} · {{ record.gradingStatus }}</p>
          <n-space>
            <n-button size="small" secondary @click="editRecord(record)">编辑</n-button>
            <n-button
              v-if="record.homework"
              size="small"
              secondary
              @click="updateGradingStatus(record.id, record.gradingStatus === '待批改' ? '已批改' : '待批改')"
            >
              {{ record.gradingStatus === "待批改" ? "标为已批改" : "重新待批改" }}
            </n-button>
          </n-space>
        </div>
      </aside>
    </div>
  </div>
</template>
