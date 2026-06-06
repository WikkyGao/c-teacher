<script setup lang="ts">
import { LogOut, Paintbrush, Plus } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { computed, reactive, ref } from "vue";
import DiagnosticsPage from "../diagnostics/DiagnosticsPage.vue";
import type { AiProviderConfig, AiProviderDraft, AppThemeKey } from "../students/studentStore";
import { appThemes, useStudentStore } from "../students/studentStore";

defineProps<{
  teacherName?: string;
}>();

const emit = defineEmits<{
  navigate: [value: "mobile"];
  logout: [];
}>();

const workspace = useStudentStore();
const message = useMessage();
const settingsPanel = ref<"main" | "diagnostics">("main");
const editingProviderId = ref<string | null>(workspace.appSettings.aiProviders[0]?.id ?? null);
const form = reactive({
  name: "",
  baseUrl: "",
  apiKey: "",
  modelName: "",
  modelPurpose: "通用"
});

const selectedProvider = computed(() => {
  return workspace.appSettings.aiProviders.find((provider) => provider.id === editingProviderId.value) ?? null;
});
const currentTheme = computed(() => appThemes.find((theme) => theme.key === workspace.appSettings.themeKey) ?? appThemes[0]);

function loadProvider(provider: AiProviderConfig | null) {
  editingProviderId.value = provider?.id ?? null;
  form.name = provider?.name ?? "";
  form.baseUrl = provider?.baseUrl ?? "";
  form.apiKey = provider?.apiKey ?? "";
  form.modelName = provider?.models[0]?.name ?? "";
  form.modelPurpose = provider?.models[0]?.purpose ?? "通用";
}

loadProvider(selectedProvider.value);

function providerStatus(provider: AiProviderConfig) {
  if (!provider.apiKey.trim()) return "待配置";
  if (provider.id === workspace.appSettings.defaultAiProviderId) return "默认供应商";
  return "已配置";
}

function providerDraft(): AiProviderDraft {
  const existingModels = selectedProvider.value?.models ?? [];
  const modelName = form.modelName.trim();
  const models =
    existingModels.length > 0
      ? existingModels.map((model, index) =>
          index === 0
            ? {
                ...model,
                name: modelName || model.name,
                purpose: form.modelPurpose.trim() || "通用",
                isDefault: model.isDefault || existingModels.length === 1
              }
            : model
        )
      : [
          {
            id: "",
            name: modelName || "default-model",
            purpose: form.modelPurpose.trim() || "通用",
            isDefault: true
          }
        ];
  return {
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey,
    models
  };
}

function saveProvider() {
  if (!form.name.trim() || !form.baseUrl.trim()) {
    message.warning("请填写供应商名称和 API Base URL");
    return;
  }
  const draft = providerDraft();
  if (editingProviderId.value) {
    workspace.updateAiProvider(editingProviderId.value, draft);
    message.success("供应商已更新");
  } else {
    workspace.createAiProvider(draft);
    message.success("供应商已新增");
  }
  loadProvider(workspace.appSettings.aiProviders[0] ?? null);
}

function createProvider() {
  editingProviderId.value = null;
  form.name = "";
  form.baseUrl = "";
  form.apiKey = "";
  form.modelName = "";
  form.modelPurpose = "通用";
}

function removeProvider(providerId: string) {
  const deleted = workspace.deleteAiProvider(providerId);
  message[deleted ? "success" : "warning"](deleted ? "供应商已删除" : "未找到供应商");
  loadProvider(workspace.appSettings.aiProviders[0] ?? null);
}

function addModel(provider: AiProviderConfig) {
  const model = {
    id: "",
    name: "new-model",
    purpose: "通用",
    isDefault: provider.models.length === 0
  };
  workspace.updateAiProvider(provider.id, {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    models: [...provider.models, model]
  });
  message.success("模型已新增，请编辑供应商后调整名称");
}

function deleteModel(provider: AiProviderConfig, modelId: string) {
  if (provider.models.length <= 1) {
    message.warning("至少保留一个模型");
    return;
  }
  workspace.updateAiProvider(provider.id, {
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    models: provider.models.filter((model) => model.id !== modelId)
  });
  message.success("模型已删除");
}

function setDefault(providerId: string, modelId: string) {
  const updated = workspace.setDefaultAiModel(providerId, modelId);
  message[updated ? "success" : "warning"](updated ? "默认模型已更新" : "未找到模型");
}

function switchTheme(themeKey: AppThemeKey) {
  workspace.setAppTheme(themeKey);
  message.success(`已切换到 ${appThemes.find((theme) => theme.key === themeKey)?.name}`);
}
</script>

<template>
  <div>
    <div class="page-top">
      <div>
        <h1 class="page-title">App 设置</h1>
        <p class="page-subtitle">管理 AI 供应商、大模型和应用皮肤。配置保存在本机工作区。</p>
      </div>
      <n-space align="center">
        <n-tag type="success" round>{{ currentTheme.name }}</n-tag>
        <n-button v-if="settingsPanel === 'diagnostics'" secondary @click="settingsPanel = 'main'">返回设置</n-button>
      </n-space>
    </div>

    <DiagnosticsPage v-if="settingsPanel === 'diagnostics'" />

    <div v-else class="settings-layout">
      <section class="side-panel wide-panel">
        <div class="panel-heading settings-heading">
          <div>
            <h2>AI 供应商与模型</h2>
            <p>维护 API 地址、密钥、模型清单和默认模型。</p>
          </div>
          <n-button type="primary" @click="createProvider">
            <template #icon>
              <Plus :size="16" />
            </template>
            新增供应商
          </n-button>
        </div>

        <div v-for="provider in workspace.appSettings.aiProviders" :key="provider.id" class="provider-card">
          <div class="provider-main">
            <h3>{{ provider.name }}</h3>
            <p>{{ provider.baseUrl }} · {{ provider.apiKey.trim() ? "API Key 已填写" : "API Key 未填写" }}</p>
            <n-tag :type="providerStatus(provider) === '待配置' ? 'warning' : 'success'" round>{{ providerStatus(provider) }}</n-tag>
          </div>
          <n-space>
            <n-button size="small" secondary @click="loadProvider(provider)">编辑</n-button>
            <n-button size="small" secondary type="error" @click="removeProvider(provider.id)">删除</n-button>
          </n-space>
          <div class="model-list">
            <div v-for="model in provider.models" :key="model.id" class="model-row">
              <div>
                <strong>{{ model.name }}</strong>
                <span>{{ model.purpose }}</span>
              </div>
              <n-space>
                <n-tag v-if="model.isDefault" type="success" round>默认</n-tag>
                <n-button v-else size="tiny" secondary @click="setDefault(provider.id, model.id)">设为默认</n-button>
                <n-button size="tiny" quaternary type="error" @click="deleteModel(provider, model.id)">删除</n-button>
              </n-space>
            </div>
            <n-button size="small" secondary @click="addModel(provider)">新增模型</n-button>
          </div>
        </div>
      </section>

      <aside>
        <section class="side-panel">
          <h2>{{ editingProviderId ? "编辑供应商" : "新增供应商" }}</h2>
          <n-form label-placement="top">
            <n-form-item label="供应商名称">
              <n-input v-model:value="form.name" placeholder="例如：OpenAI" />
            </n-form-item>
            <n-form-item label="API Base URL">
              <n-input v-model:value="form.baseUrl" placeholder="https://api.example.com/v1" />
            </n-form-item>
            <n-form-item label="API Key">
              <n-input v-model:value="form.apiKey" type="password" show-password-on="click" />
            </n-form-item>
            <n-form-item label="首个模型名称">
              <n-input v-model:value="form.modelName" placeholder="例如：gpt-5.4" />
            </n-form-item>
            <n-form-item label="模型用途">
              <n-input v-model:value="form.modelPurpose" placeholder="通用、报告生成、错题分析" />
            </n-form-item>
          </n-form>
          <n-button type="primary" @click="saveProvider">保存供应商</n-button>
        </section>

        <section class="side-panel theme-panel">
          <div class="panel-heading">
            <Paintbrush :size="18" />
            <h2>皮肤</h2>
          </div>
          <p>四套皮肤快速切换，并持久化到本机；墨蓝夜读已优化文字对比度。</p>
          <div v-for="theme in appThemes" :key="theme.key" class="theme-option" :class="{ active: workspace.appSettings.themeKey === theme.key }">
            <div class="theme-option-top">
              <div>
                <strong>{{ theme.name }}</strong>
                <span>{{ theme.description }}</span>
              </div>
              <n-button v-if="workspace.appSettings.themeKey !== theme.key" size="small" secondary @click="switchTheme(theme.key)">切换</n-button>
              <n-tag v-else type="success" round>当前</n-tag>
            </div>
            <div class="theme-swatches">
              <span v-for="color in theme.swatches" :key="color" :style="{ background: color }"></span>
            </div>
          </div>
        </section>

        <section class="side-panel">
          <h2>账号与工具</h2>
          <div class="settings-action-list">
            <button type="button" @click="emit('navigate', 'mobile')">
              <strong>手机预览</strong>
              <span>在 Mac 上查看移动端页面结构</span>
            </button>
            <button type="button" @click="settingsPanel = 'diagnostics'">
              <strong>应用诊断</strong>
              <span>查看本地数据、备份和恢复状态</span>
            </button>
            <button type="button" @click="emit('logout')">
              <strong>退出登录</strong>
              <span>{{ teacherName || "当前账号" }}</span>
              <LogOut :size="17" />
            </button>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
