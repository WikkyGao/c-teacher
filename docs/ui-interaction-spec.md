# C-Teacher 全局交互规范

## 目录

1. [按钮规范](#1-按钮规范)
2. [删除操作](#2-删除操作)
3. [返回/取消操作](#3-返回取消操作)
4. [添加/新建操作](#4-添加新建操作)
5. [编辑操作](#5-编辑操作)
6. [表单弹窗](#6-表单弹窗)
7. [页面内联表单](#7-页面内联表单)
8. [列表行操作](#8-列表行操作)
9. [空状态](#9-空状态)
10. [消息提示](#10-消息提示)
11. [角色权限控制](#11-角色权限控制)
12. [代码示例](#12-代码示例)

---

## 1. 按钮规范

### 1.1 按钮类型

| 类型 | 样式 | 使用场景 |
|------|------|---------|
| `primary` | 蓝色实底 | 主要操作：保存、新建、确认 |
| `secondary` | 灰色描边 | 次要操作：返回、取消、编辑 |
| `error` | 红色描边 | 危险操作：删除 |
| `quaternary` | 无边框 | 轻量操作：仅图标的返回按钮 |

### 1.2 按钮尺寸

| 尺寸 | 属性 | 使用场景 |
|------|------|---------|
| 默认 | 不设置 | 页面顶部操作按钮 |
| `small` | `size="small"` | 列表行内操作按钮 |
| `tiny` | `size="tiny"` | 紧凑列表行内操作按钮 |

### 1.3 图标规范

- **图标库**：lucide-vue-next
- **图标大小**：`size="16"`（默认）或 `size="14"` / `size="12"`（小按钮）
- **使用方式**：通过 `<template #icon>` 插槽

### 1.4 按钮间距

- 页面顶部按钮组：`<n-space>`
- 列表行内按钮组：`<n-space size="small">` 或 `gap: 6px`
- 表单底部按钮组：`<n-space justify="end">` 右对齐

---

## 2. 删除操作

### 2.1 按钮规范

```html
<n-button size="small" secondary type="error" @click="handleDelete(id)">
  <template #icon><Trash2 :size="14" /></template>
  删除
</n-button>
```

| 属性 | 值 | 说明 |
|------|-----|------|
| `type` | `"error"` | 红色样式 |
| `secondary` | - | 描边样式，非实底 |
| `size` | `"small"` 或 `"tiny"` | 根据上下文选择 |
| 图标 | `Trash2` | 可选，紧凑场景可省略 |

### 2.2 确认弹窗

**必须使用 `useConfirmDelete()` composable，禁止使用 `n-popconfirm`**

```typescript
import { useConfirmDelete } from "../../shared/utils/confirmDelete";

const { confirmDelete } = useConfirmDelete();

function handleDelete(id: string) {
  confirmDelete({
    content: "确定要删除xxx吗？该操作将同时删除关联数据。",
    onOk: () => {
      // 执行删除逻辑
      message.success("xxx已删除");
    }
  });
}
```

### 2.3 弹窗规范

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `title` | `"确认删除"` | 可自定义 |
| `positiveText` | `"确认删除"` | 确认按钮文案 |
| `negativeText` | `"取消"` | 取消按钮文案 |
| `content` | 必填 | 说明删除影响 |

### 2.4 删除提示文案模板

- `"确定要删除「{名称}」吗？该操作将同时删除关联的{关联数据}。"`
- `"确定要删除这条{类型}吗？"`
- `"确定要删除选中的 {数量} 项吗？"`

---

## 3. 返回/取消操作

### 3.1 页面顶部返回按钮

```html
<n-button secondary @click="goBack">
  <template #icon><ArrowLeft :size="16" /></template>
  返回{目标页面}
</n-button>
```

| 属性 | 值 |
|------|-----|
| `type` | 不设置（默认 secondary） |
| 图标 | `ArrowLeft`，`size="16"` |
| 文案 | `"返回" + 目标页面名` |

### 3.2 表单取消按钮

```html
<n-button secondary @click="goBack">取消</n-button>
<!-- 或 -->
<n-button @click="showModal = false">取消</n-button>
```

### 3.3 仅图标返回（轻量场景）

```html
<n-button quaternary @click="emit('back')">
  <template #icon><ArrowLeft :size="18" /></template>
</n-button>
```

---

## 4. 添加/新建操作

### 4.1 页面顶部按钮

```html
<n-button type="primary" @click="openCreateForm">
  <template #icon><Plus :size="16" /></template>
  新建{类型}
</n-button>
```

| 属性 | 值 |
|------|-----|
| `type` | `"primary"` |
| 图标 | `Plus`，`size="16"` |
| 文案动词 | "新增" / "新建" / "添加" |
| 位置 | 页面右上角，标题同行右侧 |

### 4.2 弹窗内添加按钮

```html
<n-button size="small" @click="openCreateForm">
  <template #icon><Plus :size="14" /></template>
  新增{类型}
</n-button>
```

---

## 5. 编辑操作

### 5.1 列表行编辑按钮

```html
<n-button size="small" secondary @click="editItem(item)">编辑</n-button>
```

| 属性 | 值 |
|------|-----|
| `secondary` | - |
| `size` | `"small"` 或 `"tiny"` |
| 图标 | 可选 `Pencil`（lucide） |
| 确认 | **不需要**确认弹窗 |

### 5.2 有图标的编辑按钮

```html
<n-button size="small" secondary @click="startEdit()">
  <template #icon><Pencil :size="14" /></template>
  编辑
</n-button>
```

---

## 6. 表单弹窗

### 6.1 基础结构

```html
<n-modal v-model:show="showModal" preset="card" :title="modalTitle" class="form-modal">
  <n-form label-placement="top">
    <n-form-item label="字段名">
      <n-input v-model:value="form.field" />
    </n-form-item>
  </n-form>
  <template #footer>
    <n-space justify="end">
      <n-button @click="showModal = false">取消</n-button>
      <n-button type="primary" @click="save">保存</n-button>
    </n-space>
  </template>
</n-modal>
```

### 6.2 规范

| 属性 | 值 |
|------|-----|
| `preset` | `"card"` |
| 标题 | `editingId ? '编辑xxx' : '新增xxx'` |
| 表单标签 | `label-placement="top"` |
| 按钮位置 | `<template #footer>` → `<n-space justify="end">` |
| 按钮顺序 | 取消 → 可选操作 → 保存（primary） |

---

## 7. 页面内联表单

### 7.1 基础结构

```html
<template v-else>
  <div class="page-top">
    <div>
      <h1 class="page-title">{{ editingId ? "编辑xxx" : "新建xxx" }}</h1>
      <p class="page-subtitle">描述信息</p>
    </div>
    <n-button secondary @click="goBack">
      <template #icon><ArrowLeft :size="16" /></template>
      返回{目标页面}
    </n-button>
  </div>
  <section class="side-panel xxx-form-page">
    <n-form label-placement="top">
      <!-- 表单字段 -->
    </n-form>
    <n-space>
      <n-button type="primary" @click="save">{{ editingId ? "保存" : "创建" }}</n-button>
      <n-button secondary @click="goBack">取消</n-button>
      <n-button v-if="editingId" secondary type="error" @click="remove">删除</n-button>
    </n-space>
  </section>
</template>
```

### 7.2 规范

| 属性 | 值 |
|------|-----|
| 表单容器 | `<section class="side-panel xxx-form-page">` |
| 顶部 | 返回按钮（secondary + ArrowLeft） |
| 底部按钮 | 左侧主操作，右侧取消/删除 |
| 保存按钮 | `<n-button type="primary">` |

---

## 8. 列表行操作

### 8.1 操作按钮排列

```html
<div class="list-row">
  <div class="list-row-left">
    <!-- 内容 -->
  </div>
  <n-space class="list-row-right" size="small">
    <n-button size="tiny" secondary @click="edit(item)">编辑</n-button>
    <n-button size="tiny" secondary type="error" @click="remove(item.id)">删除</n-button>
  </n-space>
</div>
```

### 8.2 操作按钮顺序

1. 编辑（secondary）
2. 其他次要操作（secondary）
3. 删除（error）— 永远放在最后

---

## 9. 空状态

### 9.1 列表空状态

```html
<div v-if="items.length === 0" class="empty-state">
  <n-icon size="48" color="#ccc">
    <!-- 相关图标 -->
  </n-icon>
  <p>暂无{类型}</p>
  <p class="empty-hint">点击上方"新建{类型}"开始</p>
</div>
```

### 9.2 样式

```css
.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
}

.empty-hint {
  font-size: 13px;
  color: var(--muted);
}
```

---

## 10. 消息提示

### 10.1 使用 `useMessage()`

```typescript
import { useMessage } from "naive-ui";
const message = useMessage();
```

### 10.2 消息类型

| 类型 | 方法 | 使用场景 |
|------|------|---------|
| `success` | `message.success("xxx成功")` | 操作成功 |
| `warning` | `message.warning("提示信息")` | 警告、验证失败 |
| `error` | `message.error("xxx失败")` | 操作失败 |
| `info` | `message.info("提示信息")` | 一般提示 |

### 10.3 文案模板

- 成功：`"xxx已删除"` / `"xxx已保存"` / `"已添加 xxx"`
- 警告：`"请填写xxx"` / `"至少保留一个xxx"`
- 失败：`"xxx失败：{错误信息}"`

---

## 11. 角色权限控制

### 11.1 家长角色限制

```html
<!-- 编辑按钮对家长隐藏 -->
<n-button v-if="userRole !== 'parent'" size="small" secondary @click="edit(item)">
  编辑
</n-button>

<!-- 删除按钮对家长隐藏 -->
<n-button v-if="userRole !== 'parent'" size="small" secondary type="error" @click="remove(item.id)">
  删除
</n-button>

<!-- 新建按钮对家长隐藏 -->
<n-button v-if="userRole !== 'parent'" type="primary" @click="openCreate">
  新建
</n-button>
```

---

## 12. 代码示例

### 12.1 完整的删除操作示例

```vue
<script setup lang="ts">
import { useMessage } from "naive-ui";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";

const message = useMessage();
const { confirmDelete } = useConfirmDelete();

function removeItem(itemId: string) {
  const item = items.value.find((i) => i.id === itemId);
  if (!item) return;
  
  confirmDelete({
    content: `确定要删除「${item.name}」吗？该操作将同时删除关联数据。`,
    onOk: () => {
      const deleted = deleteItem(itemId);
      if (deleted) {
        message.success("项目已删除");
      } else {
        message.warning("删除失败");
      }
    }
  });
}
</script>

<template>
  <n-button size="small" secondary type="error" @click="removeItem(item.id)">
    <template #icon><Trash2 :size="14" /></template>
    删除
  </n-button>
</template>
```

### 12.2 完整的页面顶部操作栏示例

```vue
<template>
  <div class="page-top">
    <div>
      <h1 class="page-title">页面标题</h1>
      <p class="page-subtitle">页面描述</p>
    </div>
    <n-space>
      <n-button @click="chooseFile">选择文件</n-button>
      <n-button type="primary" @click="openCreate">
        <template #icon><Plus :size="16" /></template>
        新建项目
      </n-button>
    </n-space>
  </div>
</template>
```

### 12.3 完整的表单弹窗示例

```vue
<template>
  <n-modal v-model:show="showModal" preset="card" :title="modalTitle" class="form-modal">
    <n-form label-placement="top">
      <n-form-item label="名称">
        <n-input v-model:value="form.name" placeholder="请输入名称" />
      </n-form-item>
      <n-form-item label="分类">
        <n-select v-model:value="form.category" :options="categoryOptions" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showModal = false">取消</n-button>
        <n-button type="primary" @click="save">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const showModal = ref(false);
const editingId = ref<string | null>(null);

const modalTitle = computed(() => editingId.value ? "编辑项目" : "新增项目");

const form = ref({
  name: "",
  category: ""
});

function openCreate() {
  editingId.value = null;
  form.value = { name: "", category: "" };
  showModal.value = true;
}

function openEdit(item: any) {
  editingId.value = item.id;
  form.value = { name: item.name, category: item.category };
  showModal.value = true;
}

function save() {
  // 保存逻辑
  showModal.value = false;
}
</script>
```

---

## 附录：常用 Lucide 图标

| 图标名 | 用途 | import |
|--------|------|--------|
| `Plus` | 新建/添加 | `import { Plus } from "lucide-vue-next"` |
| `Trash2` | 删除 | `import { Trash2 } from "lucide-vue-next"` |
| `ArrowLeft` | 返回 | `import { ArrowLeft } from "lucide-vue-next"` |
| `Pencil` | 编辑 | `import { Pencil } from "lucide-vue-next"` |
| `Search` | 搜索 | `import { Search } from "lucide-vue-next"` |
| `Download` | 导入/下载 | `import { Download } from "lucide-vue-next"` |
| `Upload` | 导出/上传 | `import { Upload } from "lucide-vue-next"` |
| `Settings` | 设置 | `import { Settings } from "lucide-vue-next"` |
| `Smartphone` | 手机 | `import { Smartphone } from "lucide-vue-next"` |

---

*文档版本：v1.0*
*创建日期：2026-06-27*
*适用范围：C-Teacher 桌面端所有页面*
