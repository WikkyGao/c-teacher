<script setup lang="ts">
import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, LogOut, Pencil, Plus, Upload } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import { backupBlobFromStore, backupFilename, parseWorkspaceBackupFile, triggerBackupDownload } from "../backup/workspaceBackup";
import DiagnosticsPage from "../diagnostics/DiagnosticsPage.vue";
import type { AiApiFormat, AiModelConfig, AiProviderConfig, AiProviderDraft, AppThemeKey } from "../students/studentStore";
import { appThemes, DEFAULT_MISTAKE_ANALYSIS_PROMPT, DEFAULT_SIMILAR_QUESTIONS_PROMPT, useStudentStore } from "../students/studentStore";
import { useConfirmDelete } from "../../shared/utils/confirmDelete";
import { testProviderConnection } from "../ai/aiClient";
import { fetchProviderModels, mergeFetchedModels } from "./aiModelCatalog";

defineProps<{
  teacherName?: string;
}>();

const emit = defineEmits<{
  navigate: [value: "mobile" | "backup"];
  logout: [];
}>();

const workspace = useStudentStore();
const message = useMessage();
const { confirmDelete } = useConfirmDelete();
const settingsPanel = ref<"main" | "diagnostics">("main");
const isBackingUp = ref(false);
const isRestoring = ref(false);
const isSavingPrompt = ref(false);
const isSavingSimilarPrompt = ref(false);
const showMistakePromptModal = ref(false);
const showSimilarPromptModal = ref(false);
const showThemeModal = ref(false);

// Prompt editors
const mistakePrompt = ref(workspace.appSettings.mistakeAnalysisPrompt);
const similarQuestionsPromptRef = ref(workspace.appSettings.similarQuestionsPrompt);

function saveMistakePrompt() {
  workspace.updateAppSettings({ mistakeAnalysisPrompt: mistakePrompt.value });
  isSavingPrompt.value = true;
  setTimeout(() => { isSavingPrompt.value = false; }, 1500);
}

function restoreDefaultPrompt() {
  mistakePrompt.value = DEFAULT_MISTAKE_ANALYSIS_PROMPT;
  workspace.updateAppSettings({ mistakeAnalysisPrompt: DEFAULT_MISTAKE_ANALYSIS_PROMPT });
  isSavingPrompt.value = true;
  setTimeout(() => { isSavingPrompt.value = false; }, 1500);
}

function saveSimilarQuestionsPrompt() {
  workspace.updateAppSettings({ similarQuestionsPrompt: similarQuestionsPromptRef.value });
  isSavingSimilarPrompt.value = true;
  setTimeout(() => { isSavingSimilarPrompt.value = false; }, 1500);
}

function restoreDefaultSimilarQuestionsPrompt() {
  similarQuestionsPromptRef.value = DEFAULT_SIMILAR_QUESTIONS_PROMPT;
  workspace.updateAppSettings({ similarQuestionsPrompt: DEFAULT_SIMILAR_QUESTIONS_PROMPT });
  isSavingSimilarPrompt.value = true;
  setTimeout(() => { isSavingSimilarPrompt.value = false; }, 1500);
}

function saveAndCloseMistakePrompt() {
  saveMistakePrompt();
  showMistakePromptModal.value = false;
}

function saveAndCloseSimilarPrompt() {
  saveSimilarQuestionsPrompt();
  showSimilarPromptModal.value = false;
}

// Provider modal
const showProviderModal = ref(false);
const editingProviderId = ref<string | null>(null);
const providerForm = reactive({
  name: "",
  baseUrl: "",
  apiKey: "",
  apiFormat: "openai-chat" as AiApiFormat
});
const providerFormModels = ref<AiModelConfig[]>([]);

type ProviderPreset = {
  name: string;
  baseUrl: string;
  apiFormat: AiApiFormat;
  docUrl: string;
};

const providerPresets: ProviderPreset[] = [
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiFormat: "openai-chat",
    docUrl: "https://openrouter.ai/docs"
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiFormat: "openai-chat",
    docUrl: "https://api-docs.deepseek.com/"
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiFormat: "anthropic-messages",
    docUrl: "https://docs.anthropic.com/en/api"
  },
  {
    name: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiFormat: "nvidia",
    docUrl: "https://build.nvidia.com/models"
  }
];

const providerNameOptions = [
  ...providerPresets.map((preset) => ({ label: preset.name, value: preset.name })),
  { label: "自定义", value: "__custom__" }
];
const selectedFetchedModelNames = ref<string[]>([]);

// Model modal
const showModelModal = ref(false);
const editingProviderForModel = ref<AiProviderConfig | null>(null);
const editingModelId = ref<string | null>(null);
const modelForm = reactive({
  name: "",
  purpose: "",
  supportsVision: false
});

const isTestingModel = ref(false);

const isFetchingModels = ref(false);

const currentTheme = computed(() => appThemes.find((theme) => theme.key === workspace.appSettings.themeKey) ?? appThemes[0]);

function providerStatus(provider: AiProviderConfig) {
  if (!provider.apiKey.trim()) return "待配置";
  if (provider.connectionStatus === "异常") return "连接异常";
  if (provider.connectionStatus === "可用") return "已连接";
  return "待测试";
}

function providerStatusType(provider: AiProviderConfig) {
  if (!provider.apiKey.trim() || provider.connectionStatus === "异常") return "warning" as const;
  if (provider.connectionStatus === "可用") return "success" as const;
  return "default" as const;
}

// --- Provider modal ---
function openCreateProvider() {
  editingProviderId.value = null;
  providerForm.name = "";
  providerForm.baseUrl = "";
  providerForm.apiKey = "";
  providerForm.apiFormat = "openai-chat";
  providerFormModels.value = [];
  selectedFetchedModelNames.value = [];
  showProviderModal.value = true;
}

function openEditProvider(provider: AiProviderConfig) {
  editingProviderId.value = provider.id;
  providerForm.name = provider.name;
  providerForm.baseUrl = provider.baseUrl;
  providerForm.apiKey = provider.apiKey;
  providerForm.apiFormat = provider.apiFormat ?? "openai-chat";
  providerFormModels.value = provider.models.map((model) => ({ ...model }));
  selectedFetchedModelNames.value = provider.models.map((model) => model.name);
  showProviderModal.value = true;
}

function onSelectProviderName(value: string) {
  if (editingProviderId.value) return;
  const preset = providerPresets.find((p) => p.name === value);
  if (preset) {
    providerForm.baseUrl = preset.baseUrl;
    providerForm.apiFormat = preset.apiFormat;
  }
}

async function fetchModelsFromForm() {
  if (!providerForm.baseUrl.trim() || !providerForm.apiKey.trim()) {
    message.warning("请先填写接口地址和密钥");
    return;
  }
  isFetchingModels.value = true;
  try {
    const fetched = await fetchProviderModels({
      baseUrl: providerForm.baseUrl.trim(),
      apiKey: providerForm.apiKey
    });
    if (fetched.length === 0) {
      message.warning("接口正常但未返回任何模型数据，请手动添加");
      return;
    }
    const existingSelectedNames = new Set(selectedFetchedModelNames.value);
    providerFormModels.value = mergeFetchedModels(providerFormModels.value, fetched);
    // 不自动选中任何模型
    const finalSelected: string[] = [];
    for (const name of selectedFetchedModelNames.value) {
      if (providerFormModels.value.some((m) => m.name === name)) {
        finalSelected.push(name);
      }
    }
    selectedFetchedModelNames.value = finalSelected;
    message.success(`已获取 ${fetched.length} 个模型：${fetched.map((m: { name: string }) => m.name).join("、")}`);
  } catch (error) {
    message.error(`获取模型列表失败：${String(error)}`);
  } finally {
    isFetchingModels.value = false;
  }
}

function saveProvider() {
  if (!providerForm.name.trim() || !providerForm.baseUrl.trim()) {
    message.warning("请填写供应商名称和接口地址");
    return;
  }
  const existing = editingProviderId.value ? workspace.appSettings.aiProviders.find((p) => p.id === editingProviderId.value) : null;
  const selectedNames = new Set(selectedFetchedModelNames.value);
  const models = providerFormModels.value.filter((model) => selectedNames.has(model.name));
  const fallbackModels = existing?.models ?? [];
  const draft: AiProviderDraft = {
    name: providerForm.name.trim(),
    baseUrl: providerForm.baseUrl.trim(),
    apiKey: providerForm.apiKey,
    apiFormat: providerForm.apiFormat,
    models: models.length > 0 ? models : fallbackModels.length > 0 ? fallbackModels : [{ id: "", name: "默认模型", purpose: "通用", isDefault: true, supportsVision: false }]
  };
  if (editingProviderId.value) {
    workspace.updateAiProvider(editingProviderId.value, draft);
    message.success("供应商已更新");
  } else {
    workspace.createAiProvider(draft);
    message.success("供应商已新增");
  }
  showProviderModal.value = false;
}

function removeProvider(providerId: string) {
  confirmDelete({
    content: "确定要删除这个 AI 供应商吗？关联的模型也将一并移除。",
    onOk: () => {
      const deleted = workspace.deleteAiProvider(providerId);
      message[deleted ? "success" : "warning"](deleted ? "供应商已删除" : "未找到供应商");
    }
  });
}

// --- Model modal ---
function openCreateModel(provider: AiProviderConfig) {
  editingProviderForModel.value = provider;
  editingModelId.value = null;
  modelForm.name = "";
  modelForm.purpose = "通用";
  modelForm.supportsVision = false;
  showModelModal.value = true;
}

function openEditModel(provider: AiProviderConfig, model: { id: string; name: string; purpose: string; supportsVision?: boolean }) {
  editingProviderForModel.value = provider;
  editingModelId.value = model.id;
  modelForm.name = model.name;
  modelForm.purpose = model.purpose;
  modelForm.supportsVision = model.supportsVision ?? false;
  showModelModal.value = true;
}

function saveModel() {
  const provider = editingProviderForModel.value;
  if (!provider || !modelForm.name.trim()) return;
  const models = [...provider.models];
  if (editingModelId.value) {
    const idx = models.findIndex((m) => m.id === editingModelId.value);
    if (idx >= 0) {
      models[idx] = { ...models[idx], name: modelForm.name.trim(), purpose: modelForm.purpose.trim() || "通用", supportsVision: modelForm.supportsVision };
    }
  } else {
    models.push({ id: "", name: modelForm.name.trim(), purpose: modelForm.purpose.trim() || "通用", isDefault: models.length === 0, supportsVision: modelForm.supportsVision });
  }
  workspace.updateAiProvider(provider.id, {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    apiFormat: provider.apiFormat,
    models
  });
  message.success(editingModelId.value ? "模型已更新" : "模型已新增");
  showModelModal.value = false;
}

async function testConnectionFromModel() {
  const provider = editingProviderForModel.value;
  const modelName = modelForm.name.trim();
  if (!provider || !modelName) {
    message.warning("请先填写模型名称");
    return;
  }
  if (!provider.baseUrl.trim() || !provider.apiKey.trim()) {
    message.warning("请先在供应商中配置接口地址和密钥");
    return;
  }
  isTestingModel.value = true;
  const testProvider: AiProviderConfig = {
    ...provider,
    models: [{ id: editingModelId.value ?? "__test_model__", name: modelName, purpose: modelForm.purpose.trim() || "通用", isDefault: true, supportsVision: modelForm.supportsVision }]
  };
  try {
    const ok = await testProviderConnection(testProvider);
    const providerRef = workspace.appSettings.aiProviders.find((item) => item.id === provider.id);
    if (providerRef) providerRef.connectionStatus = ok ? "可用" : "异常";
    message[ok ? "success" : "warning"](ok ? "模型连接成功" : "模型连接失败，请检查接口地址、密钥和模型名称");
  } catch (error) {
    const providerRef = workspace.appSettings.aiProviders.find((item) => item.id === provider.id);
    if (providerRef) providerRef.connectionStatus = "异常";
    message.error(`模型连接测试失败：${String(error)}`);
  } finally {
    isTestingModel.value = false;
  }
}

function deleteModel(provider: AiProviderConfig, modelId: string) {
  if (provider.models.length <= 1) {
    message.warning("至少保留一个模型");
    return;
  }
  confirmDelete({
    content: `确定要删除模型「${provider.models.find((m) => m.id === modelId)?.name ?? modelId}」吗？`,
    onOk: () => {
      workspace.updateAiProvider(provider.id, {
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        apiFormat: provider.apiFormat,
        models: provider.models.filter((model) => model.id !== modelId)
      });
      message.success("模型已删除");
    }
  });
}

function setDefault(providerId: string, modelId: string) {
  const updated = workspace.setDefaultAiModel(providerId, modelId);
  message[updated ? "success" : "warning"](updated ? "默认模型已更新" : "未找到模型");
}

function setDefaultProvider(providerId: string) {
  const provider = workspace.appSettings.aiProviders.find((p) => p.id === providerId);
  if (!provider) return;
  const defaultModel = provider.models.find((m) => m.isDefault) ?? provider.models[0];
  if (defaultModel) {
    workspace.setDefaultAiModel(providerId, defaultModel.id);
    message.success(`默认供应商已切换为「${provider.name}」`);
  } else {
    message.warning("该供应商没有可用模型");
  }
}

function switchTheme(themeKey: AppThemeKey) {
  workspace.setAppTheme(themeKey);
  message.success(`已切换到 ${appThemes.find((theme) => theme.key === themeKey)?.name}`);
}

async function exportBackup() {
  isBackingUp.value = true;
  if (!isTauri()) {
    try {
      triggerBackupDownload(backupBlobFromStore(workspace), backupFilename());
      message.success("备份已下载");
    } catch (error) {
      message.error(`导出失败：${String(error)}`);
    } finally {
      isBackingUp.value = false;
    }
    return;
  }
  try {
    const path = await save({
      defaultPath: backupFilename(),
      filters: [{ name: "C-teacher 备份", extensions: ["json"] }]
    });
    if (!path) return;
    await invoke("export_workspace_backup", { path });
    message.success("数据备份已导出");
  } catch (error) {
    message.error(`导出失败：${String(error)}`);
  } finally {
    isBackingUp.value = false;
  }
}

const backupFileInput = ref<HTMLInputElement>();

async function onBackupFilePicked(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  target.value = "";
  isRestoring.value = true;
  try {
    const backup = await parseWorkspaceBackupFile(file);
    workspace.applyPersistedState(backup.state);
    message.success("数据已恢复");
  } catch (error) {
    message.error(`恢复失败：${String(error)}`);
  } finally {
    isRestoring.value = false;
  }
}

function confirmRestore() {
  const { confirmAction } = useConfirmDelete();
  confirmAction({
    title: "恢复数据",
    content: "导入备份将覆盖当前所有数据，包括学生、课程、课堂记录、提醒和设置。此操作不可撤销，确认继续？",
    positiveText: "确认导入",
    onOk: async () => {
      isRestoring.value = true;
      if (!isTauri()) {
        backupFileInput.value?.click();
        isRestoring.value = false;
        return;
      }
      try {
        const path = await open({
          multiple: false,
          filters: [{ name: "C-teacher 备份", extensions: ["json"] }]
        });
        if (typeof path !== "string") return;
        await invoke("import_workspace_backup", { path });
        await workspace.reloadWorkspace();
        message.success("数据已恢复，工作台已刷新");
      } catch (error) {
        message.error(`恢复失败：${String(error)}`);
      } finally {
        isRestoring.value = false;
      }
    }
  });
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">应用设置</h1>
        <p class="page-subtitle">管理 AI 供应商、大模型和应用皮肤。配置保存在本机工作区。</p>
      </div>
      <n-space align="center">
        <n-button v-if="settingsPanel === 'diagnostics'" secondary @click="settingsPanel = 'main'">返回设置</n-button>
      </n-space>
    </div>

    <input
      ref="backupFileInput"
      type="file"
      accept=".json"
      style="display:none"
      @change="onBackupFilePicked"
    />
    <DiagnosticsPage v-if="settingsPanel === 'diagnostics'" />

    <div v-else>
      <section class="settings-grid">
        <!-- AI 供应商 -->
        <div class="settings-card">
          <div class="settings-card-head">
            <div>
              <h2>AI 供应商</h2>
              <p>维护 API 地址、密钥和模型清单</p>
            </div>
            <n-button type="primary" size="small" @click="openCreateProvider">
              <template #icon><Plus :size="14" /></template>
              新增供应商
            </n-button>
          </div>

          <div v-if="workspace.appSettings.aiProviders.length === 0" class="settings-empty">
            暂无供应商，点击上方按钮新增
          </div>
          <div v-for="provider in workspace.appSettings.aiProviders.slice(0, 2)" :key="provider.id" class="provider-list-item">
            <div class="provider-info">
              <div class="provider-name-row">
                <n-switch
                  :value="provider.id === workspace.appSettings.defaultAiProviderId"
                  @update:value="(val: boolean) => val && setDefaultProvider(provider.id)"
                  size="small"
                />
                <strong>{{ provider.name }}</strong>
                <span class="provider-url">{{ provider.baseUrl }}</span>
              </div>
              <n-tag round size="small" :type="providerStatusType(provider)">{{ providerStatus(provider) }}</n-tag>
            </div>
            <div class="provider-models">
              <div v-for="model in provider.models" :key="model.id" class="model-chip">
                <span>{{ model.name }}</span>
                <n-tag v-if="model.isDefault && provider.id === workspace.appSettings.defaultAiProviderId" size="tiny" type="success" round>默认</n-tag>
              </div>
              <n-button size="tiny" quaternary @click="openCreateModel(provider)">+ 新增模型</n-button>
            </div>
            <div class="provider-actions">
              <n-button size="tiny" secondary @click="openEditProvider(provider)">编辑</n-button>
              <n-button size="tiny" secondary type="error" @click="removeProvider(provider.id)">删除</n-button>
            </div>
          </div>
          <div v-if="workspace.appSettings.aiProviders.length > 2" class="settings-more-link">
            <n-button quaternary @click="showProviderModal = true">查看全部 {{ workspace.appSettings.aiProviders.length }} 个供应商 →</n-button>
          </div>
        </div>

        <!-- AI 提示词 -->
        <div class="settings-card">
          <div class="settings-card-head">
            <div>
              <h2>AI 提示词</h2>
              <p>自定义错题分析和出类似题的系统提示词</p>
            </div>
          </div>
          <div class="settings-action-list settings-action-list-row">
            <button type="button" @click="showMistakePromptModal = true">
              <strong>AI 分析提示词</strong>
              <span>{{ mistakePrompt.slice(0, 60) }}...</span>
            </button>
            <button type="button" @click="showSimilarPromptModal = true">
              <strong>出类似题提示词</strong>
              <span>{{ similarQuestionsPromptRef.slice(0, 60) }}...</span>
            </button>
          </div>
        </div>

        <!-- 账号与工具 -->
        <div class="settings-card">
          <div class="settings-card-head">
            <h2>账号与工具</h2>
          </div>
          <div class="settings-action-list settings-action-list-row">
            <button type="button" @click="emit('navigate', 'mobile')">
              <strong>手机预览</strong>
              <span>查看移动端</span>
            </button>
            <button type="button" @click="settingsPanel = 'diagnostics'">
              <strong>应用诊断</strong>
              <span>数据状态</span>
            </button>
            <button type="button" @click="emit('navigate', 'backup')">
              <strong>数据备份</strong>
              <span>导出恢复</span>
            </button>
            <button type="button" @click="emit('logout')">
              <strong>退出登录</strong>
              <span>{{ teacherName || "当前账号" }}</span>
              <LogOut :size="17" />
            </button>
          </div>
        </div>

        <!-- 皮肤 + 数据备份 并排 -->
        <div class="settings-card span-right">
          <!-- 皮肤 -->
          <div>
            <div class="settings-card-head">
              <div>
                <h2>皮肤</h2>
                <p>切换主题</p>
              </div>
              <n-button size="small" secondary @click="showThemeModal = true">
                <template #icon><Pencil :size="14" /></template>
                切换
              </n-button>
            </div>
            <div class="current-theme-preview">
              <div class="theme-preview-info">
                <strong>{{ currentTheme.name }}</strong>
                <span>{{ currentTheme.description }}</span>
              </div>
              <div class="theme-swatches">
                <span v-for="color in currentTheme.swatches" :key="color" :style="{ background: color }"></span>
              </div>
            </div>
          </div>
          <!-- 数据备份 -->
          <div>
            <div class="settings-card-head">
              <div>
                <h2>数据备份</h2>
                <p>导出或恢复</p>
              </div>
            </div>
            <div class="settings-action-list">
              <button type="button" @click="exportBackup" :disabled="isBackingUp || isRestoring">
                <Download :size="17" />
                <div>
                  <strong>{{ isBackingUp ? "导出中…" : "导出备份" }}</strong>
                  <span>保存为 .json 文件</span>
                </div>
              </button>
              <button type="button" class="restore-btn" @click="confirmRestore" :disabled="isBackingUp || isRestoring">
                <Upload :size="17" />
                <div>
                  <strong>{{ isRestoring ? "恢复中…" : "恢复数据" }}</strong>
                  <span>从备份文件导入</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Provider Modal -->
      <n-modal v-model:show="showProviderModal" preset="card" :title="editingProviderId ? '编辑供应商' : '新增供应商'" class="form-modal">
        <n-form label-placement="top">
          <n-form-item label="供应商名称">
            <n-select
              v-if="!editingProviderId"
              v-model:value="providerForm.name"
              :options="providerNameOptions"
              placeholder="选择已研究的供应商或自定义"
              filterable
              tag
              @update:value="onSelectProviderName"
            />
            <n-input
              v-else
              v-model:value="providerForm.name"
              readonly
            />
          </n-form-item>
          <n-form-item label="接口地址">
            <n-input v-model:value="providerForm.baseUrl" placeholder="https://api.example.com/v1" />
          </n-form-item>
          <n-form-item label="接口密钥">
            <n-input v-model:value="providerForm.apiKey" type="password" show-password-on="click" :placeholder="providerPresets.some(p => p.name === providerForm.name) ? '输入你的 API Key' : 'sk-...'" />
          </n-form-item>
          <n-form-item label="API 格式">
            <n-radio-group v-model:value="providerForm.apiFormat">
              <n-radio value="openai-chat">OpenAI Chat</n-radio>
              <n-radio value="openai-responses">OpenAI Responses</n-radio>
              <n-radio value="anthropic-messages">Anthropic Messages</n-radio>
              <n-radio value="nvidia">NVIDIA NIM</n-radio>
            </n-radio-group>
          </n-form-item>
          <div v-if="providerPresets.some(p => p.name === providerForm.name)" class="muted-text" style="margin-top:-8px;">
            {{ providerPresets.find(p => p.name === providerForm.name)?.docUrl }} — 接口地址和格式已自动填写
          </div>
        </n-form>
        <div v-if="providerFormModels.length > 0" class="fetched-model-list">
          <n-form-item label="选择模型（可搜索）">
            <n-select
              v-model:value="selectedFetchedModelNames"
              :options="providerFormModels.map(m => ({ label: m.name, value: m.name }))"
              multiple
              filterable
              placeholder="搜索并选择要添加的模型"
              clearable
            />
          </n-form-item>
        </div>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showProviderModal = false">取消</n-button>
            <n-button :loading="isFetchingModels" @click="fetchModelsFromForm">获取模型</n-button>
            <n-button type="primary" @click="saveProvider">保存</n-button>
          </n-space>
        </template>
      </n-modal>

      <!-- Model Modal -->
      <n-modal v-model:show="showModelModal" preset="card" :title="editingModelId ? '编辑模型' : '新增模型'" class="form-modal">
        <n-form label-placement="top">
          <n-form-item label="模型名称">
            <n-input v-model:value="modelForm.name" placeholder="例如：gpt-5.4 / claude-sonnet-4-6" />
          </n-form-item>
          <n-form-item label="模型用途">
            <n-input v-model:value="modelForm.purpose" placeholder="通用、报告生成、错题分析" />
          </n-form-item>
          <n-form-item label="图片识别">
            <n-switch v-model:value="modelForm.supportsVision" />
            <span class="muted-text" style="margin-left:8px">开启后，错题本支持上传图片让 AI 识别分析</span>
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showModelModal = false">取消</n-button>
            <n-button :loading="isTestingModel" @click="testConnectionFromModel">测试连接</n-button>
            <n-button type="primary" @click="saveModel">保存</n-button>
          </n-space>
        </template>
      </n-modal>

      <!-- Mistake Prompt Modal -->
      <n-modal v-model:show="showMistakePromptModal" preset="card" title="编辑 AI 分析提示词" class="form-modal" style="max-width: 800px;">
        <n-form label-placement="top">
          <n-form-item label="提示词内容">
            <n-input
              v-model:value="mistakePrompt"
              type="textarea"
              placeholder="输入 AI 系统提示词..."
              :autosize="{ minRows: 12, maxRows: 24 }"
            />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="space-between">
            <n-button size="small" secondary @click="restoreDefaultPrompt">恢复默认</n-button>
            <n-space>
              <n-button @click="showMistakePromptModal = false">取消</n-button>
              <n-button type="primary" @click="saveAndCloseMistakePrompt">保存</n-button>
            </n-space>
          </n-space>
        </template>
      </n-modal>

      <!-- Similar Questions Prompt Modal -->
      <n-modal v-model:show="showSimilarPromptModal" preset="card" title="编辑出类似题提示词" class="form-modal" style="max-width: 800px;">
        <n-form label-placement="top">
          <n-form-item label="提示词内容（支持模板变量：{{original_question}}、{{knowledge_points}}）">
            <n-input
              v-model:value="similarQuestionsPromptRef"
              type="textarea"
              placeholder="输入出类似题的 AI 提示词..."
              :autosize="{ minRows: 12, maxRows: 24 }"
            />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="space-between">
            <n-button size="small" secondary @click="restoreDefaultSimilarQuestionsPrompt">恢复默认</n-button>
            <n-space>
              <n-button @click="showSimilarPromptModal = false">取消</n-button>
              <n-button type="primary" @click="saveAndCloseSimilarPrompt">保存</n-button>
            </n-space>
          </n-space>
        </template>
      </n-modal>

      <!-- Theme Modal -->
      <n-modal v-model:show="showThemeModal" preset="card" title="切换皮肤" class="form-modal">
        <div v-for="theme in appThemes" :key="theme.key" class="theme-option" :class="{ active: workspace.appSettings.themeKey === theme.key }">
          <div class="theme-option-top">
            <div>
              <strong>{{ theme.name }}</strong>
              <span>{{ theme.description }}</span>
            </div>
            <n-button
              v-if="workspace.appSettings.themeKey !== theme.key"
              size="small"
              secondary
              @click="switchTheme(theme.key); showThemeModal = false"
            >切换</n-button>
            <n-tag v-else size="small" type="success" round>当前</n-tag>
          </div>
          <div class="theme-swatches">
            <span v-for="color in theme.swatches" :key="color" :style="{ background: color }"></span>
          </div>
        </div>
      </n-modal>
    </div>
  </div>
</template>

<style scoped>
/* Settings layout */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 860px;
  width: 100%;
}

/* Provider list items */
.provider-list-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
}

.provider-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.provider-name-row strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.provider-url {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.provider-models {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 46px;
}

.model-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text);
}

.provider-actions {
  display: flex;
  gap: 6px;
  padding-left: 46px;
}

.settings-more-link {
  padding-top: 4px;
  text-align: center;
}

</style>
