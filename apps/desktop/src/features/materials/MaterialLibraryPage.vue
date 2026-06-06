<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import type { MaterialSourceProtocol, ScannedMaterial, TeachingMaterial } from "../students/studentStore";
import { useStudentStore } from "../students/studentStore";
import { createMaterialFileDraft } from "./materialFile";

const workspace = useStudentStore();
const message = useMessage();
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
const sourceForm = reactive({
  protocol: "smb" as MaterialSourceProtocol,
  name: "工作室 NAS",
  host: "studio-nas.local",
  path: "/C-teacher/teaching-materials",
  authMethod: "系统钥匙串"
});
const studentOptions = computed(() => {
  return workspace.items.map((student) => ({ label: student.name, value: student.id }));
});
const protocolOptions = [
  { label: "SMB", value: "smb" },
  { label: "FTP", value: "ftp" },
  { label: "本地目录", value: "local" }
];
const filteredMaterials = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  if (!keyword) return workspace.materials;
  return workspace.materials.filter((material) => {
    const assignedNames = material.assignedStudentIds
      .map((id) => workspace.items.find((student) => student.id === id)?.name ?? "")
      .join(" ");
    return [material.title, material.category, material.tags.join(" "), assignedNames, material.sourcePath]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
});

function names(ids: string[]) {
  return ids.map((id) => workspace.items.find((student) => student.id === id)?.name ?? id).join("、");
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
    sourcePath: materialForm.sourcePath.trim()
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
  const deleted = workspace.deleteMaterial(materialId);
  if (deleted) {
    if (editingMaterialId.value === materialId) resetMaterialForm();
    message.success("资料已删除");
  }
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
  message.success("已选择本地资料，请确认分类和学生分配后保存");
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

function saveSource() {
  if (!sourceForm.host.trim() && sourceForm.protocol !== "local") {
    message.warning("请填写服务器地址");
    return;
  }
  workspace.createMaterialSource({ ...sourceForm });
  message.success("资料源已保存，可在列表中测试连接");
}

function testSource(sourceId: string) {
  const available = workspace.testMaterialSource(sourceId);
  message[available ? "success" : "warning"](available ? "资料源状态已更新为可用" : "资料源缺少连接地址或路径");
}

function removeSource(sourceId: string) {
  const deleted = workspace.deleteMaterialSource(sourceId);
  if (deleted) message.success("资料源已删除");
}

function normalizeSourcePath(protocol: MaterialSourceProtocol, host: string, path: string) {
  if (protocol === "local") return path.trim();
  if (protocol === "ftp") {
    const trimmedHost = host.trim().replace(/^ftp:\/\//, "").replace(/\/+$/, "");
    const trimmedPath = path.trim();
    const normalizedPath = trimmedPath ? `/${trimmedPath.replace(/^\/+/, "")}` : "/";
    return `ftp://${trimmedHost}${normalizedPath}`;
  }
  if (protocol === "smb" && path.trim().startsWith("/")) return path.trim();
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

  isScanning.value = true;
  try {
    const scanned = await invoke<ScannedMaterial[]>("scan_material_source", { path });
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
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">资料库与分配</h1>
        <p class="page-subtitle">搜索资料、查看学生归属并连接外部共享资料源</p>
      </div>
      <n-space>
        <n-button secondary @click="chooseMaterialFile">选择本地文件</n-button>
        <n-button type="primary" @click="saveMaterial">{{ materialFormTitle }}</n-button>
      </n-space>
    </div>

    <div class="dashboard-grid">
      <section class="side-panel wide-panel">
        <n-input v-model:value="query" placeholder="搜索资料、标签、学生进度..." />

        <div class="inline-form">
          <n-input v-model:value="materialForm.title" placeholder="资料名称" />
          <n-input v-model:value="materialForm.category" placeholder="分类" />
          <n-input v-model:value="materialForm.tags" placeholder="标签，用逗号分隔" />
          <n-select v-model:value="materialForm.assignedStudentIds" multiple :options="studentOptions" placeholder="分配给学生" />
          <n-select v-model:value="materialForm.sourceType" :options="protocolOptions" placeholder="来源" />
          <n-input v-model:value="materialForm.sourcePath" placeholder="文件路径或共享路径" />
        </div>
        <n-space>
          <n-button secondary @click="chooseMaterialFile">选择本地文件</n-button>
          <n-button type="primary" @click="saveMaterial">{{ materialFormTitle }}</n-button>
          <n-button v-if="editingMaterialId" secondary @click="resetMaterialForm">取消编辑</n-button>
        </n-space>

        <div v-for="material in filteredMaterials" :key="material.id" class="list-row">
          <strong>{{ material.title }}</strong>
          <p>分类：{{ material.category }} · 标签：{{ material.tags.join(" / ") || "无" }} · {{ names(material.assignedStudentIds) || "未分配" }}</p>
          <p>来源：{{ material.sourceType.toUpperCase() }} · {{ material.sourcePath || "待补充路径" }} · {{ material.syncStatus }}</p>
          <n-space>
            <n-button size="small" secondary @click="openMaterial(material)">打开</n-button>
            <n-button size="small" secondary @click="editMaterial(material)">编辑</n-button>
            <n-button size="small" secondary type="error" @click="removeMaterial(material.id)">删除</n-button>
          </n-space>
        </div>
      </section>

      <aside class="side-panel">
        <h2>外部共享资料源</h2>
        <n-form label-placement="top">
          <n-form-item label="协议">
            <n-select v-model:value="sourceForm.protocol" :options="protocolOptions" />
          </n-form-item>
          <n-form-item label="名称">
            <n-input v-model:value="sourceForm.name" />
          </n-form-item>
          <n-form-item label="服务器地址">
            <n-input v-model:value="sourceForm.host" />
          </n-form-item>
          <n-form-item label="共享路径">
            <n-input v-model:value="sourceForm.path" />
          </n-form-item>
        </n-form>
        <n-space>
          <n-button secondary @click="chooseLocalDirectory">选择本地目录</n-button>
          <n-button secondary :disabled="workspace.materialSources.length === 0" @click="testSource(workspace.materialSources[0]?.id)">测试连接</n-button>
          <n-button type="primary" @click="saveSource">保存资料源</n-button>
          <n-button type="primary" secondary :loading="isScanning" @click="scanSource()">扫描当前目录</n-button>
        </n-space>
        <div v-for="source in workspace.materialSources" :key="source.id" class="source-row">
          <strong>{{ source.name }} · {{ source.protocol.toUpperCase() }}</strong>
          <p>{{ source.host }}{{ source.path }} · {{ source.connectionStatus }}</p>
          <n-space>
            <n-button size="small" secondary @click="testSource(source.id)">测试</n-button>
            <n-button size="small" secondary :loading="isScanning" @click="scanSource(source.id)">扫描导入</n-button>
            <n-button size="small" secondary type="error" @click="removeSource(source.id)">删除</n-button>
          </n-space>
        </div>
      </aside>
    </div>
  </div>
</template>
