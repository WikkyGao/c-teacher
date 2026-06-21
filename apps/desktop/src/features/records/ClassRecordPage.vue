<script setup lang="ts">
import { Plus, ArrowLeft } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { ClassRecord, GradingStatus } from "../children/childStore";
import { useChildStore } from "../children/childStore";
import type { UserRole } from "../auth/authSession";

const props = defineProps<{
  userRole?: UserRole;
}>();

const workspace = useChildStore();
const message = useMessage();
const pageMode = ref<"list" | "form">("list");
const editingRecordId = ref<string | null>(null);
const assignMode = ref<"child" | "group">("child");

const form = reactive({
  studentId: workspace.activeChildId,
  groupId: null as string | null,
  subject: workspace.activeChild.courses[0]?.subject ?? "数学",
  lessonContent: "",
  performance: "",
  homework: ""
});

const childOptions = computed(() => {
  return workspace.items.map((child) => ({ label: child.name, value: child.id }));
});
const groupOptions = computed(() =>
  workspace.groups.map((g) => ({ label: `${g.name}（${g.type === "class" ? "班级" : "科目"}）`, value: g.id }))
);
const selectedChild = computed(() => workspace.items.find((s) => s.id === form.studentId) ?? workspace.activeChild);

function resetForm() {
  editingRecordId.value = null;
  assignMode.value = "child";
  form.studentId = workspace.activeChildId;
  form.groupId = null;
  form.subject = workspace.activeChild.courses[0]?.subject ?? "数学";
  form.lessonContent = "";
  form.performance = "";
  form.homework = "";
}

function editRecord(record: ClassRecord) {
  editingRecordId.value = record.id;
  assignMode.value = "child";
  form.studentId = record.studentId;
  form.groupId = null;
  form.subject = record.subject;
  form.lessonContent = record.lessonContent;
  form.performance = record.performance;
  form.homework = record.homework;
  pageMode.value = "form";
}

function openCreateForm() {
  resetForm();
  pageMode.value = "form";
}

function saveRecord() {
  if (!form.lessonContent.trim()) {
    message.warning("请填写授课内容");
    return;
  }
  if (assignMode.value === "child") {
    if (!form.studentId) {
      message.warning("请选择小孩");
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
      message.success("课堂记录已更新");
    } else {
      workspace.createClassRecord(draft);
      message.success("课堂记录已保存");
    }
  } else {
    if (!form.groupId) {
      message.warning("请选择班级或分组");
      return;
    }
    const group = workspace.groups.find((g) => g.id === form.groupId);
    if (!group || group.memberIds.length === 0) {
      message.warning("该分组下没有小孩");
      return;
    }
    for (const studentId of group.memberIds) {
      workspace.createClassRecord({
        studentId,
        subject: form.subject.trim() || "未分类",
        lessonContent: form.lessonContent.trim(),
        performance: form.performance.trim(),
        homework: form.homework.trim()
      });
    }
    message.success(`课堂记录已为该分组 ${group.memberIds.length} 名小孩创建`);
  }
  pageMode.value = "list";
  editingRecordId.value = null;
}

function studentName(studentId: string) {
  return workspace.items.find((child) => child.id === studentId)?.name ?? studentId;
}

function updateGradingStatus(recordId: string, status: GradingStatus) {
  const updated = workspace.updateHomeworkGradingStatus(recordId, status);
  message[updated ? "success" : "warning"](updated ? "批改状态已更新" : "这条记录没有可批改作业");
}

function goBack() {
  pageMode.value = "list";
  resetForm();
}
</script>

<template>
  <div>
    <div class="page-top">
      <template v-if="pageMode === 'list'">
        <div>
          <h1 class="page-title">课堂记录</h1>
          <p class="page-subtitle">记录授课内容、小孩表现和作业布置</p>
        </div>
        <n-button v-if="props.userRole !== 'parent'" type="primary" @click="openCreateForm">
          <template #icon>
            <Plus :size="16" />
          </template>
          新建课堂记录
        </n-button>
      </template>
      <template v-else>
        <div>
          <h1 class="page-title">{{ editingRecordId ? "编辑课堂记录" : "新建课堂记录" }}</h1>
          <p class="page-subtitle">记录授课内容、小孩表现和作业布置</p>
        </div>
        <n-button secondary @click="goBack">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          返回记录列表
        </n-button>
      </template>
    </div>

    <template v-if="pageMode === 'list'">
      <div class="dashboard-grid">
        <aside class="side-panel wide-panel">
          <h2>历史记录</h2>
          <div v-for="record in workspace.classRecords" :key="record.id" class="list-row compact-row">
            <strong>{{ studentName(record.studentId) }} · {{ record.subject }}</strong>
            <p>{{ record.lessonContent }}</p>
            <p>作业：{{ record.homework || "未布置" }} · {{ record.gradingStatus }}</p>
            <n-space>
              <n-button v-if="props.userRole !== 'parent'" size="small" secondary @click="editRecord(record)">编辑</n-button>
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
          <div v-if="workspace.classRecords.length === 0" class="muted-text">暂无课堂记录</div>
        </aside>
      </div>
    </template>

    <template v-else>
      <section class="side-panel schedule-form-page">
        <n-form label-placement="top">
          <n-form-item label="记录归属" v-if="!editingRecordId">
            <n-radio-group v-model:value="assignMode">
              <n-radio value="child">单个小孩</n-radio>
              <n-radio value="group">班级/分组</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item v-if="assignMode === 'child'" label="小孩">
            <n-select v-model:value="form.studentId" :options="childOptions" />
          </n-form-item>
          <n-form-item v-else label="班级/分组">
            <n-select v-model:value="form.groupId" :options="groupOptions" placeholder="选择班级或分组" />
          </n-form-item>
          <n-form-item label="科目">
            <n-input v-model:value="form.subject" />
          </n-form-item>
          <n-form-item label="授课内容">
            <n-input v-model:value="form.lessonContent" type="textarea" />
          </n-form-item>
          <n-form-item label="小孩表现">
            <n-input v-model:value="form.performance" type="textarea" />
          </n-form-item>
          <n-form-item label="作业布置">
            <n-input v-model:value="form.homework" />
          </n-form-item>
          <p v-if="assignMode === 'group'" class="muted-text">选择班级或分组后，记录将自动为该分组内的所有小孩创建。</p>
          <n-space>
            <n-button type="primary" @click="saveRecord">{{ editingRecordId ? "更新课堂记录" : "保存课堂记录" }}</n-button>
            <n-button secondary @click="goBack">取消</n-button>
          </n-space>
        </n-form>
      </section>
    </template>
  </div>
</template>
