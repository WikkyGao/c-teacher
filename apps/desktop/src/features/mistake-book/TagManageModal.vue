<script setup lang="ts">
import { computed, ref } from "vue";
import {
  NButton,
  NEmpty,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
} from "naive-ui";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useStudentStore, type MistakeTag } from "../students/studentStore";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
}>();

const students = useStudentStore();
const { mistakeTags } = storeToRefs(students);

const newTagName = ref("");
const newTagCategory = ref("");
const editingTag = ref<MistakeTag | null>(null);
const editName = ref("");
const editCategory = ref("");
const searchKeyword = ref("");

const categoryOptions = [
  { label: "数学", value: "数学" },
  { label: "语文", value: "语文" },
  { label: "英语", value: "英语" },
  { label: "物理", value: "物理" },
  { label: "化学", value: "化学" },
  { label: "生物", value: "生物" },
  { label: "历史", value: "历史" },
  { label: "地理", value: "地理" },
  { label: "政治", value: "政治" },
  { label: "信息技术", value: "信息技术" },
  { label: "科学", value: "科学" },
  { label: "其他", value: "其他" },
];

const filteredTags = computed(() => {
  let tags = mistakeTags.value;
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase();
    tags = tags.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        t.category.toLowerCase().includes(kw)
    );
  }
  return tags;
});

const groupedTags = computed(() => {
  const groups: Record<string, MistakeTag[]> = {};
  for (const tag of filteredTags.value) {
    const cat = tag.category || "未分类";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tag);
  }
  return groups;
});

const categoryColors: Record<string, string> = {
  数学: "#3b82f6",
  语文: "#ef4444",
  英语: "#8b5cf6",
  物理: "#f59e0b",
  化学: "#10b981",
  生物: "#06b6d4",
  历史: "#f97316",
  地理: "#14b8a6",
  政治: "#ec4899",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || "#6b7280";
}

async function handleAddTag() {
  const name = newTagName.value.trim();
  const category = newTagCategory.value.trim() || "其他";
  if (!name) return;
  await students.createMistakeTag(name, category);
  newTagName.value = "";
  newTagCategory.value = "";
}

function startEdit(tag: MistakeTag) {
  editingTag.value = tag;
  editName.value = tag.name;
  editCategory.value = tag.category;
}

async function saveEdit() {
  if (!editingTag.value) return;
  const name = editName.value.trim();
  if (!name) return;
  await students.updateMistakeTag(editingTag.value.id, {
    name,
    category: editCategory.value || "其他",
  });
  editingTag.value = null;
}

function cancelEdit() {
  editingTag.value = null;
}

async function handleDeleteTag(id: string) {
  await students.deleteMistakeTag(id);
}
</script>

<template>
  <n-modal
    :show="props.show"
    @update:show="emit('update:show', $event)"
    title="标签管理"
    :style="{ width: '600px' }"
    preset="card"
    :segmented="{ content: true }"
  >
    <!-- 添加标签 -->
    <div class="add-tag-section">
      <n-space align="center" size="small">
        <n-input
          v-model:value="newTagName"
          placeholder="标签名称"
          size="small"
          style="width: 180px"
          @keyup.enter="handleAddTag"
        />
        <n-select
          v-model:value="newTagCategory"
          :options="categoryOptions"
          size="small"
          style="width: 120px"
          placeholder="分类"
        />
        <n-button type="primary" size="small" @click="handleAddTag" :disabled="!newTagName.trim()">
          <template #icon><Plus :size="14" /></template>
          添加
        </n-button>
      </n-space>
    </div>

    <!-- 搜索 -->
    <n-input
      v-model:value="searchKeyword"
      placeholder="搜索标签..."
      size="small"
      clearable
      style="margin-bottom: 16px"
    />

    <!-- 标签列表 -->
    <div class="tag-list-container">
      <n-empty v-if="Object.keys(groupedTags).length === 0" description="暂无标签" />

      <div v-for="(tags, category) in groupedTags" :key="category" class="tag-group">
        <div class="group-header">
          <span class="group-dot" :style="{ background: getCategoryColor(category as string) }"></span>
          <span class="group-name">{{ category }}</span>
          <span class="group-count">{{ tags.length }}</span>
        </div>

        <div class="group-tags">
          <div v-for="tag in tags" :key="tag.id" class="tag-item">
            <template v-if="editingTag?.id === tag.id">
              <n-space size="small" align="center">
                <n-input
                  v-model:value="editName"
                  size="tiny"
                  style="width: 120px"
                  @keyup.enter="saveEdit"
                />
                <n-select
                  v-model:value="editCategory"
                  :options="categoryOptions"
                  size="tiny"
                  style="width: 100px"
                />
                <n-button size="tiny" type="primary" @click="saveEdit">保存</n-button>
                <n-button size="tiny" quaternary @click="cancelEdit">取消</n-button>
              </n-space>
            </template>
            <template v-else>
              <n-tag
                :bordered="false"
                size="small"
                :style="{
                  '--n-color': getCategoryColor(tag.category) + '15',
                  '--n-text-color': getCategoryColor(tag.category),
                  '--n-border': '1px solid ' + getCategoryColor(tag.category) + '30',
                }"
              >
                {{ tag.name }}
              </n-tag>
              <div class="tag-actions">
                <n-button size="tiny" quaternary @click.stop="startEdit(tag)">
                  <template #icon><Pencil :size="12" /></template>
                </n-button>
                <n-popconfirm
                  @positive-click="handleDeleteTag(tag.id)"
                  :show-icon="false"
                >
                  <template #trigger>
                    <n-button size="tiny" quaternary type="error">
                      <template #icon><Trash2 :size="12" /></template>
                    </n-button>
                  </template>
                  确定删除标签「{{ tag.name }}」？
                </n-popconfirm>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <span class="tag-summary">共 {{ mistakeTags.length }} 个标签</span>
        <n-button @click="emit('update:show', false)">关闭</n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.add-tag-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8edf2;
}

.tag-list-container {
  max-height: 400px;
  overflow-y: auto;
}

.tag-group {
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #5a6b7f;
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.group-count {
  font-size: 12px;
  color: #8896a7;
  font-weight: 400;
}

.group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.tag-item:hover .tag-actions {
  opacity: 1;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-summary {
  font-size: 13px;
  color: #8896a7;
}
</style>
