<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { MaterialSourceProtocol, ScannedMaterial, TeachingMaterial } from "../children/childStore";
import { useChildStore } from "../children/childStore";
import { createMaterialFileDraft } from "./materialFile";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import { childLabel } from "../../shared/utils/childLabel";
import type { UserRole } from "../auth/authSession";

const props = defineProps<{ userRole?: UserRole }>();

const cl = computed(() => childLabel(props.userRole));

const workspace = useChildStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();

const query = ref("");
const isScanning = ref(false);
const editingMaterialId = ref<string | null>(null);
const materialFormTitle = computed(() => (editingMaterialId.value ? "更新资料" : "上传资料"));

const materialForm = reactive({
  title: "",
  category: "",
  tags: "",
  assignedStudentIds: [] as string[],
  sourceType: "local" as MaterialSourceProtocol,
  sourcePath: ""
});

const editingSourceId = ref<string | null>(null);

const sourceForm = reactive({
  protocol: "smb" as MaterialSourceProtocol,
  name: "工作室 NAS",
  host: "studio-nas.local",
  path: "/C-teacher/teaching-materials",
  authMethod: "系统钥匙串",
  username: "",
  password: ""
});

const childOptions = computed(() => {
  return workspace.items.map((child) => ({ label: child.name, value: child.id }));
});

const protocolOptions = [
  { label: "SMB", value: "smb" },
  { label: "FTP", value: "ftp" },
  { label: "本地目录", value: "local" }
];

// ── 筛选器状态 ──
const filterCategory = ref<string | null>(null);
const filterTag = ref<string | null>(null);
const filterFileType = ref<string | null>(null);

const allCategories = computed(() => {
  const set = new Set(workspace.materials.map((m) => m.category).filter(Boolean));
  return [...set].sort().map((c) => ({ label: c, value: c }));
});

const allTags = computed(() => {
  const set = new Set(workspace.materials.flatMap((m) => m.tags).filter(Boolean));
  return [...set].sort().map((t) => ({ label: t, value: t }));
});

const allFileTypes = computed(() => {
  const set = new Set(workspace.materials.map((m) => getFileTypeLabel(m)).filter(Boolean));
  return [...set].sort().map((t) => ({ label: t, value: t }));
});

function getFileTypeLabel(material: TeachingMaterial): string {
  const ext = material.sourcePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "PDF", png: "图片", jpg: "图片", jpeg: "图片", webp: "图片",
    doc: "Word", docx: "Word", ppt: "PPT", pptx: "PPT",
    xls: "Excel", xlsx: "Excel", mp4: "视频", mov: "视频",
    txt: "文本", md: "Markdown"
  };
  return map[ext] ?? material.category;
}

function resetFilters() {
  filterCategory.value = null;
  filterTag.value = null;
  filterFileType.value = null;
}

const hasActiveFilters = computed(() =>
  filterCategory.value !== null || filterTag.value !== null || filterFileType.value !== null
);

// ── 筛选逻辑 ──
const filteredMaterials = computed(() => {
  let result = workspace.materials;

  const keyword = query.value.trim().toLowerCase();
  if (keyword) {
    result = result.filter((material) => {
      const assignedNames = material.assignedStudentIds
        .map((id) => workspace.items.find((child) => child.id === id)?.name ?? "")
        .join(" ");
      return [material.title, material.category, material.tags.join(" "), assignedNames, material.sourcePath]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }

  if (filterCategory.value) {
    result = result.filter((m) => m.category === filterCategory.value);
  }
  if (filterTag.value) {
    result = result.filter((m) => m.tags.includes(filterTag.value!));
  }
  if (filterFileType.value) {
    result = result.filter((m) => getFileTypeLabel(m) === filterFileType.value);
  }

  return result;
});

// ── 批量操作 ──
const selectedMaterialIds = ref<Set<string>>(new Set());
const isAllSelected = computed(() =>
  filteredMaterials.value.length > 0 && filteredMaterials.value.every((m) => selectedMaterialIds.value.has(m.id))
);
const selectedCount = computed(() => selectedMaterialIds.value.size);

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedMaterialIds.value = new Set();
  } else {
    selectedMaterialIds.value = new Set(filteredMaterials.value.map((m) => m.id));
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedMaterialIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedMaterialIds.value = next;
}

function clearSelection() {
  selectedMaterialIds.value = new Set();
}

function batchDelete() {
  if (selectedMaterialIds.value.size === 0) return;
  confirmDelete({
    content: `确定要删除选中的 ${selectedMaterialIds.value.size} 份资料吗？已分配该资料的${cl.value}将不再能访问。`,
    onOk: () => {
      const count = workspace.batchDeleteMaterials([...selectedMaterialIds.value]);
      clearSelection();
      message.success(`已删除 ${count} 份资料`);
    }
  });
}

const showBatchAssignModal = ref(false);
const batchAssignStudentIds = ref<string[]>([]);

function openBatchAssign() {
  batchAssignStudentIds.value = [];
  showBatchAssignModal.value = true;
}

function confirmBatchAssign() {
  if (batchAssignStudentIds.value.length === 0) {
    message.warning(`请选择至少一个${cl.value}`);
    return;
  }
  const count = workspace.batchAssignMaterials([...selectedMaterialIds.value], batchAssignStudentIds.value);
  showBatchAssignModal.value = false;
  clearSelection();
  message.success(`已为 ${count} 份资料分配${cl.value}`);
}

const showBatchCategoryModal = ref(false);
const batchCategory = ref("");

function openBatchCategory() {
  batchCategory.value = "";
  showBatchCategoryModal.value = true;
}

function confirmBatchCategory() {
  if (!batchCategory.value.trim()) {
    message.warning("请填写分类名称");
    return;
  }
  const count = workspace.batchCategorizeMaterials([...selectedMaterialIds.value], batchCategory.value.trim());
  showBatchCategoryModal.value = false;
  clearSelection();
  message.success(`已将 ${count} 份资料归入「${batchCategory.value.trim()}」分类`);
}

// ── 资料预览 ──
const showPreviewModal = ref(false);
const previewMaterial = ref<TeachingMaterial | null>(null);

function previewFile(material: TeachingMaterial) {
  previewMaterial.value = material;
  showPreviewModal.value = true;
}

function isImageFile(material: TeachingMaterial): boolean {
  const ext = material.sourcePath.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "webp"].includes(ext);
}

function isPdfFile(material: TeachingMaterial): boolean {
  return material.sourcePath.toLowerCase().endsWith(".pdf");
}

// ── 拖拽上传 ──
const isDragging = ref(false);
const dragUploadCount = ref(0);

const SUPPORTED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "mp4", "mov", "txt", "md"];

function isSupportedFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function onDragEnter(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
}

function onDragLeave(e: DragEvent) {
  e.preventDefault();
  if (e.currentTarget === e.target) {
    isDragging.value = false;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  let imported = 0;
  let skipped = 0;

  for (const file of Array.from(files)) {
    if (!isSupportedFile(file.name)) {
      skipped++;
      continue;
    }

    const draft = createMaterialFileDraft(file.name);
    workspace.createMaterial({
      title: draft.title,
      category: draft.category,
      tags: draft.tags,
      assignedStudentIds: [],
      sourceType: "local",
      sourcePath: file.name,
      shareable: false
    });
    imported++;
  }

  dragUploadCount.value = imported;
  if (imported > 0) {
    message.success(`已导入 ${imported} 份资料${skipped > 0 ? `，跳过 ${skipped} 个不支持的文件` : ""}`);
  } else if (skipped > 0) {
    message.warning(`跳过了 ${skipped} 个不支持的文件格式`);
  }
}

// ── 原有功能 ──
function names(ids: string[]) {
  return ids.map((id) => workspace.items.find((child) => child.id === id)?.name ?? id).join("、");
}

function tagsFromText(text: string) {
  return text
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function resetMaterialForm() {
  editingMaterialId.value = null;
  materialForm.title = "";
  materialForm.category = "";
  materialForm.tags = "";
  materialForm.assignedStudentIds = [];
  materialForm.sourceType = "local";
  materialForm.sourcePath = "";
}

function editMaterial(material: TeachingMaterial) {
  editingMaterialId.value = material.id;
  materialForm.title = material.title;
  materialForm.category = material.category;
  materialForm.tags = material.tags.join("，");
  materialForm.assignedStudentIds = [...material.assignedStudentIds];
  materialForm.sourceType = material.sourceType;
  materialForm.sourcePath = material.sourcePath;
}

function saveMaterial() {
  if (!materialForm.title.trim()) {
    message.warning("请填写资料名称");
    return;
  }
  const draft = {
    title: materialForm.title.trim(),
    category: materialForm.category.trim() || "未分类",
    tags: tagsFromText(materialForm.tags),
    assignedStudentIds: materialForm.assignedStudentIds,
    sourceType: materialForm.sourceType,
    sourcePath: materialForm.sourcePath.trim(),
    shareable: editingMaterialId.value
      ? (workspace.materials.find((m) => m.id === editingMaterialId.value)?.shareable ?? false)
      : false
  };
  if (editingMaterialId.value) {
    workspace.updateMaterial(editingMaterialId.value, draft);
    message.success("资料已更新");
  } else {
    workspace.createMaterial(draft);
    message.success("资料已加入资料库");
  }
  resetMaterialForm();
}

function removeMaterial(materialId: string) {
  confirmDelete({
    content: `确定要删除这份资料吗？已分配该资料的${cl.value}将不再能访问。`,
    onOk: () => {
      const deleted = workspace.deleteMaterial(materialId);
      if (deleted) {
        if (editingMaterialId.value === materialId) resetMaterialForm();
        message.success("资料已删除");
      }
    }
  });
}

function toggleShareable(material: TeachingMaterial) {
  workspace.updateMaterial(material.id, {
    ...material,
    shareable: !material.shareable
  });
}

async function chooseMaterialFile() {
  if (!isTauri()) {
    message.info("Web 预览环境不能打开系统文件选择器，请在 Tauri 桌面端使用");
    return;
  }
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "教学资料",
        extensions: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "mp4", "mov", "txt", "md"]
      }
    ]
  });
  if (typeof selected !== "string") return;

  const draft = createMaterialFileDraft(selected);
  editingMaterialId.value = null;
  materialForm.title = draft.title;
  materialForm.category = draft.category;
  materialForm.tags = draft.tags.join("，");
  materialForm.sourceType = "local";
  materialForm.sourcePath = draft.sourcePath;
  message.success(`已选择本地资料，请确认分类和${cl.value}分配后保存`);
}

async function openMaterial(material: TeachingMaterial) {
  if (!material.sourcePath.trim()) {
    message.warning("这份资料还没有路径");
    return;
  }
  if (!isTauri()) {
    message.info("Web 预览环境不能打开本机或共享资料，请在 Tauri 桌面端使用");
    return;
  }
  try {
    await invoke("open_material_target", { path: material.sourcePath });
    message.success("已交给系统打开资料");
  } catch (error) {
    message.error(`打开资料失败：${String(error)}`);
  }
}

function resetSourceForm() {
  editingSourceId.value = null;
  sourceForm.protocol = "smb";
  sourceForm.name = "工作室 NAS";
  sourceForm.host = "studio-nas.local";
  sourceForm.path = "/C-teacher/teaching-materials";
  sourceForm.authMethod = "系统钥匙串";
  sourceForm.username = "";
  sourceForm.password = "";
}

function editSource(source: any) {
  editingSourceId.value = source.id;
  sourceForm.protocol = source.protocol;
  sourceForm.name = source.name;
  sourceForm.host = source.host;
  sourceForm.path = source.path;
  sourceForm.authMethod = source.authMethod;
  sourceForm.username = source.username || "";
  sourceForm.password = source.password || "";
}

function saveSource() {
  if (!sourceForm.host.trim() && sourceForm.protocol !== "local") {
    message.warning("请填写服务器地址");
    return;
  }
  if (editingSourceId.value) {
    workspace.updateMaterialSource(editingSourceId.value, { ...sourceForm });
    message.success("资料源已更新");
    resetSourceForm();
  } else {
    workspace.createMaterialSource({ ...sourceForm });
    message.success("资料源已保存，可在列表中测试连接");
  }
}

function testSource(sourceId: string) {
  const available = workspace.testMaterialSource(sourceId);
  message[available ? "success" : "warning"](available ? "资料源状态已更新为可用" : "资料源缺少连接地址或路径");
}

function removeSource(sourceId: string) {
  confirmDelete({
    content: "确定要删除这个外部资料源吗？已索引的资料不受影响。",
    onOk: () => {
      const deleted = workspace.deleteMaterialSource(sourceId);
      if (deleted) message.success("资料源已删除");
    }
  });
}

function normalizeSourcePath(protocol: MaterialSourceProtocol, host: string, path: string) {
  if (protocol === "local") return path.trim();
  if (protocol === "ftp") {
    const trimmedHost = host.trim().replace(/^ftp:\/\//, "").replace(/\/+$/, "");
    const trimmedPath = path.trim();
    const normalizedPath = trimmedPath ? `/${trimmedPath.replace(/^\/+/, "")}` : "/";
    return `ftp://${trimmedHost}${normalizedPath}`;
  }
  if (protocol === "smb") {
    const trimmedPath = path.trim();
    if (trimmedPath.startsWith("/")) {
      return trimmedPath;
    }
    const trimmedHost = host.trim().replace(/^smb:\/\//, "").replace(/\/+$/, "");
    const normalizedPath = trimmedPath ? `/${trimmedPath.replace(/^\/+/, "")}` : "/";
    return `smb://${trimmedHost}${normalizedPath}`;
  }
  return `${host.trim()}${path.trim()}`;
}

async function chooseLocalDirectory() {
  if (!isTauri()) {
    message.info("Web 预览环境不能打开系统目录选择器，请在 Tauri 桌面端使用");
    return;
  }
  const selected = await open({
    directory: true,
    multiple: false
  });
  if (typeof selected === "string") {
    sourceForm.protocol = "local";
    sourceForm.host = "";
    sourceForm.path = selected;
    sourceForm.name = selected.split("/").filter(Boolean).at(-1) ?? "本地资料目录";
  }
}

async function scanSource(sourceId?: string) {
  const source = sourceId ? workspace.materialSources.find((item) => item.id === sourceId) : null;
  const protocol = source?.protocol ?? sourceForm.protocol;

  const path = source
    ? normalizeSourcePath(source.protocol, source.host, source.path)
    : normalizeSourcePath(sourceForm.protocol, sourceForm.host, sourceForm.path);
  if (!path) {
    message.warning("请先选择或填写资料目录路径");
    return;
  }
  if (!isTauri()) {
    message.info("Web 预览环境不能扫描本机目录，请在 Tauri 桌面端使用");
    return;
  }

  const username = source?.username ?? sourceForm.username;
  const password = source?.password ?? sourceForm.password;

  isScanning.value = true;
  try {
    const scanned = await invoke<ScannedMaterial[]>("scan_material_source", { 
      path,
      username: username || null,
      password: password || null
    });
    const imported = workspace.importScannedMaterials(scanned, protocol);
    message.success(`扫描到 ${scanned.length} 个资料文件，新增导入 ${imported} 个`);
  } catch (error) {
    message.error(`扫描失败：${String(error)}`);
  } finally {
    isScanning.value = false;
  }
}
</script>

<template>
  <div
    class="material-page"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="page-top">
      <div>
        <h1 class="page-title">资料库与分配</h1>
        <p class="page-subtitle">搜索资料、查看{{ cl }}归属并连接外部共享资料源</p>
      </div>
      <n-space>
        <n-button @click="chooseMaterialFile">
          <template #icon>
            <n-icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </n-icon>
          </template>
          选择本地文件
        </n-button>
        <n-button type="primary" @click="saveMaterial">
          <template #icon>
            <n-icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </n-icon>
          </template>
          添加资料
        </n-button>
      </n-space>
    </div>

    <!-- 拖拽上传遮罩 -->
    <Transition name="fade">
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-overlay-content">
          <n-icon size="48" color="#18a058">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </n-icon>
          <p>松开鼠标上传资料</p>
          <p class="drag-hint">支持 PDF、图片、视频、文档等 14 种格式</p>
        </div>
      </div>
    </Transition>

    <div class="dashboard-grid">
      <!-- 左侧主区域 -->
      <section class="side-panel main-panel">
        <!-- 搜索和筛选 -->
        <div class="search-section">
          <n-input
            v-model:value="query"
            placeholder="搜索资料、标签、{{ cl }}进度..."
            clearable
          >
            <template #prefix>
              <n-icon>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </n-icon>
            </template>
          </n-input>

          <div class="filter-bar">
            <n-select
              v-model:value="filterCategory"
              :options="allCategories"
              placeholder="分类"
              clearable
              size="small"
            />
            <n-select
              v-model:value="filterTag"
              :options="allTags"
              placeholder="标签"
              clearable
              size="small"
            />
            <n-select
              v-model:value="filterFileType"
              :options="allFileTypes"
              placeholder="文件类型"
              clearable
              size="small"
            />
            <n-button v-if="hasActiveFilters" size="small" quaternary @click="resetFilters">
              重置筛选
            </n-button>
            <span class="filter-count">{{ filteredMaterials.length }} / {{ workspace.materials.length }}</span>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <Transition name="slide">
          <div v-if="selectedCount > 0" class="batch-bar">
            <div class="batch-info">
              <n-checkbox :checked="isAllSelected" @update:checked="toggleSelectAll">
                全选
              </n-checkbox>
              <span class="batch-count">已选择 {{ selectedCount }} 项</span>
            </div>
            <n-space size="small">
              <n-button size="small" @click="openBatchAssign">批量分配</n-button>
              <n-button size="small" @click="openBatchCategory">批量分类</n-button>
              <n-button size="small" secondary type="error" @click="batchDelete">批量删除</n-button>
              <n-button size="small" quaternary @click="clearSelection">取消选择</n-button>
            </n-space>
          </div>
        </Transition>

        <!-- 资料列表 -->
        <div class="material-list">
          <div v-if="filteredMaterials.length === 0" class="empty-state">
            <n-icon size="48" color="#ccc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </n-icon>
            <p>暂无资料</p>
            <p class="empty-hint">点击上方"添加资料"或拖拽文件到此区域</p>
          </div>

          <div v-for="material in filteredMaterials" :key="material.id" class="material-row">
            <div class="material-row-left">
              <n-checkbox
                :checked="selectedMaterialIds.has(material.id)"
                @update:checked="toggleSelect(material.id)"
              />
              <div class="material-preview" @click="previewFile(material)">
                <img
                  v-if="isImageFile(material)"
                  :src="material.sourcePath"
                  class="material-thumb"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <div v-else-if="isPdfFile(material)" class="material-thumb-pdf">
                  <n-icon size="20" color="#e74c3c">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5zM8 14h2v2H8v-2zm0 4h8v2H8v-2zm4-4h4v2h-4v-2z"/>
                    </svg>
                  </n-icon>
                  <span class="material-thumb-label">PDF</span>
                </div>
                <div v-else class="material-thumb-file">
                  <n-icon size="20" color="#999">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                    </svg>
                  </n-icon>
                  <span class="material-thumb-label">{{ material.sourcePath.split(".").pop()?.toUpperCase() }}</span>
                </div>
              </div>
              <div class="material-info">
                <strong>{{ material.title }}</strong>
                <p class="material-meta">
                  <span class="meta-tag">{{ material.category }}</span>
                  <span v-for="tag in material.tags.slice(0, 3)" :key="tag" class="meta-tag tag">{{ tag }}</span>
                  <span v-if="material.tags.length > 3" class="meta-tag">+{{ material.tags.length - 3 }}</span>
                </p>
                <p class="material-assign">
                  {{ names(material.assignedStudentIds) || "未分配" }}
                </p>
              </div>
            </div>
            <div class="material-row-right">
              <n-button
                size="small"
                :type="material.shareable ? 'success' : 'default'"
                @click="toggleShareable(material)"
              >
                {{ material.shareable ? "可共享" : "共享" }}
              </n-button>
              <n-button size="small" secondary @click="openMaterial(material)">打开</n-button>
              <n-button size="small" secondary @click="editMaterial(material)">编辑</n-button>
              <n-button size="small" secondary type="error" @click="removeMaterial(material.id)">删除</n-button>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧面板 -->
      <aside class="side-panel source-panel">
        <h2>外部共享资料源</h2>
        <n-form label-placement="top" size="small">
          <n-form-item label="协议">
            <n-select v-model:value="sourceForm.protocol" :options="protocolOptions" />
          </n-form-item>
          <n-form-item label="名称">
            <n-input v-model:value="sourceForm.name" />
          </n-form-item>
          <n-form-item label="服务器地址">
            <n-input v-model:value="sourceForm.host" />
            <template #feedback>
              <span v-if="sourceForm.protocol === 'smb'" class="form-hint">例：studio-nas.local 或 192.168.1.100</span>
              <span v-else-if="sourceForm.protocol === 'ftp'" class="form-hint">例：ftp.example.com 或 192.168.1.100</span>
            </template>
          </n-form-item>
          <n-form-item label="共享路径">
            <n-input v-model:value="sourceForm.path" />
            <template #feedback>
              <span v-if="sourceForm.protocol === 'smb'" class="form-hint">输入本地挂载路径，如：/Volumes/电子书/C-teacher</span>
              <span v-else-if="sourceForm.protocol === 'ftp'" class="form-hint">例：/teaching-materials 或 /public/docs</span>
              <span v-else class="form-hint">例：/Users/xxx/Documents/teaching</span>
            </template>
          </n-form-item>
          <n-form-item v-if="sourceForm.protocol === 'smb' || sourceForm.protocol === 'ftp'" label="用户名">
            <n-input v-model:value="sourceForm.username" placeholder="留空则使用访客登录" />
          </n-form-item>
          <n-form-item v-if="sourceForm.protocol === 'smb' || sourceForm.protocol === 'ftp'" label="密码">
            <n-input v-model:value="sourceForm.password" type="password" show-password-on="click" placeholder="留空则使用访客登录" />
          </n-form-item>
          <div v-if="sourceForm.protocol === 'smb'" class="smb-hint">
            <p><strong>使用步骤：</strong></p>
            <p>1. 打开 Finder → 前往 → 连接服务器</p>
            <p>2. 输入服务器地址：smb://{{ sourceForm.host }}</p>
            <p>3. 登录后共享目录会挂载到 /Volumes/ 目录</p>
            <p>4. 在下方「共享路径」填写挂载后的<b>完整本地路径</b></p>
            <div class="smb-example">
              <p>例如挂载后在 /Volumes/电子书 目录</p>
              <p>共享路径应填：<code>/Volumes/电子书{{ sourceForm.path }}</code></p>
            </div>
          </div>
        </n-form>
        <n-space size="small">
          <n-button @click="chooseLocalDirectory">选择本地目录</n-button>
          <n-button
            :disabled="workspace.materialSources.length === 0"
            @click="testSource(workspace.materialSources[0]?.id)"
          >
            测试连接
          </n-button>
          <n-button type="primary" @click="saveSource">{{ editingSourceId ? "更新资料源" : "保存资料源" }}</n-button>
          <n-button type="primary" secondary :loading="isScanning" @click="scanSource()">
            扫描当前目录
          </n-button>
          <n-button v-if="editingSourceId" quaternary @click="resetSourceForm">取消编辑</n-button>
        </n-space>

        <div class="source-list">
          <div v-if="workspace.materialSources.length === 0" class="empty-state small">
            <p>暂无外部资料源</p>
          </div>
          <div v-for="source in workspace.materialSources" :key="source.id" class="source-row">
            <div class="source-info">
              <strong>{{ source.name }}</strong>
              <p>{{ source.protocol.toUpperCase() }} · {{ source.host }}{{ source.path }}</p>
              <p class="source-status">
                <span :class="['status-dot', source.connectionStatus === '可用' ? 'available' : 'unavailable']"></span>
                {{ source.connectionStatus }}
              </p>
            </div>
            <n-space size="small">
              <n-button size="tiny" secondary @click="editSource(source)">编辑</n-button>
              <n-button size="tiny" secondary @click="testSource(source.id)">测试</n-button>
              <n-button size="tiny" secondary :loading="isScanning" @click="scanSource(source.id)">扫描</n-button>
              <n-button size="tiny" secondary type="error" @click="removeSource(source.id)">删除</n-button>
            </n-space>
          </div>
        </div>
      </aside>
    </div>

    <!-- 资料预览弹窗 -->
    <n-modal v-model:show="showPreviewModal" preset="card" title="资料预览" style="max-width: 720px">
      <template v-if="previewMaterial">
        <div class="preview-content">
          <img
            v-if="isImageFile(previewMaterial)"
            :src="previewMaterial.sourcePath"
            class="preview-image"
          />
          <div v-else-if="isPdfFile(previewMaterial)" class="preview-pdf">
            <n-icon size="64" color="#e74c3c">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H14a1 1 0 0 1-1-1V3.5zM8 14h2v2H8v-2zm0 4h8v2H8v-2zm4-4h4v2h-4v-2z"/>
              </svg>
            </n-icon>
            <p>{{ previewMaterial.title }}</p>
            <n-button secondary @click="openMaterial(previewMaterial)">用系统程序打开</n-button>
          </div>
          <div v-else class="preview-generic">
            <n-icon size="64" color="#999">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
              </svg>
            </n-icon>
            <p>{{ previewMaterial.title }}</p>
            <p class="preview-meta">{{ previewMaterial.category }} · {{ previewMaterial.sourcePath.split(".").pop()?.toUpperCase() }}</p>
            <n-button secondary @click="openMaterial(previewMaterial)">用系统程序打开</n-button>
          </div>
        </div>
        <n-descriptions :column="2" label-placement="left" bordered size="small" style="margin-top: 16px">
          <n-descriptions-item label="分类">{{ previewMaterial.category }}</n-descriptions-item>
          <n-descriptions-item label="标签">{{ previewMaterial.tags.join("、") || "无" }}</n-descriptions-item>
          <n-descriptions-item label="分配">{{ names(previewMaterial.assignedStudentIds) || "未分配" }}</n-descriptions-item>
          <n-descriptions-item label="来源">{{ previewMaterial.sourceType.toUpperCase() }}</n-descriptions-item>
          <n-descriptions-item label="路径" :span="2">{{ previewMaterial.sourcePath || "待补充" }}</n-descriptions-item>
        </n-descriptions>
      </template>
    </n-modal>

    <!-- 批量分配弹窗 -->
    <n-modal v-model:show="showBatchAssignModal" preset="card" title="批量分配资料" style="max-width: 480px">
      <n-select v-model:value="batchAssignStudentIds" multiple :options="childOptions" :placeholder="`选择要分配的${cl}`" />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showBatchAssignModal = false">取消</n-button>
          <n-button type="primary" @click="confirmBatchAssign">确认分配</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 批量分类弹窗 -->
    <n-modal v-model:show="showBatchCategoryModal" preset="card" title="批量分类" style="max-width: 400px">
      <n-input v-model:value="batchCategory" placeholder="输入分类名称" />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showBatchCategoryModal = false">取消</n-button>
          <n-button type="primary" @click="confirmBatchCategory">确认分类</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.material-page {
  position: relative;
}

.search-section {
  display: grid;
  gap: 12px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-count {
  font-size: 12px;
  color: var(--muted);
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.batch-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-count {
  font-size: 13px;
  color: var(--primary);
  font-weight: 600;
}

.material-list {
  display: grid;
  gap: 8px;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 48px 20px;
  text-align: center;
  color: var(--muted);
}

.empty-state.small {
  padding: 24px 16px;
}

.empty-hint {
  font-size: 13px;
  color: var(--muted);
}

.material-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.material-row:hover {
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: var(--shadow-sm);
}

.material-row-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.material-row-right {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.material-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  transition: border-color 0.15s, transform 0.15s;
}

.material-preview:hover {
  border-color: var(--primary);
  transform: scale(1.05);
}

.material-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.material-thumb-pdf,
.material-thumb-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.material-thumb-label {
  font-size: 9px;
  color: var(--muted);
  font-weight: 600;
}

.material-info {
  flex: 1;
  min-width: 0;
}

.material-info strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--text);
}

.material-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 0;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 600;
}

.meta-tag.tag {
  background: var(--primary-soft);
  color: var(--primary);
}

.material-assign {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.source-panel {
  display: grid;
  gap: 14px;
}

.source-list {
  display: grid;
  gap: 8px;
}

.source-row {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
}

.source-info strong {
  display: block;
  font-size: 14px;
  color: var(--text);
}

.source-info p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.source-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.available {
  background: #18a058;
}

.status-dot.unavailable {
  background: #d9d9d9;
}

/* 拖拽遮罩 */
.drag-overlay {
  position: fixed;
  inset: 0;
  background: rgba(24, 160, 88, 0.08);
  border: 3px dashed #18a058;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-overlay-content {
  text-align: center;
  color: #18a058;
}

.drag-overlay-content p {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.drag-hint {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--muted) !important;
}

/* 预览弹窗 */
.preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: var(--radius-md);
  object-fit: contain;
}

.preview-pdf,
.preview-generic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
}

.preview-meta {
  font-size: 13px;
  color: var(--muted);
}

/* 表单提示 */
.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.smb-hint {
  padding: 10px 12px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--muted-strong);
}

.smb-hint p {
  margin: 2px 0;
}

.smb-example {
  margin-top: 6px !important;
  padding: 4px 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  color: var(--primary);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin: 0;
  padding: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 60px;
}
</style>
