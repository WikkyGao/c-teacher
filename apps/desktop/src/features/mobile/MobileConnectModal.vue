<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { NModal, NButton, NTag, useMessage } from "naive-ui";
import { Copy, ExternalLink, Loader2, QrCode, Wifi, WifiOff } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import QRCode from "qrcode";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "new-image", path: string): void;
}>();

const message = useMessage();

const GO_API_PORT = 18080;
const localIp = ref("");
const httpOk = ref(false);
const wsConnected = ref(false);
const testing = ref(true);
const lastUpload = ref<{ path: string; filename: string; time: string } | null>(null);
const qrCanvas = ref<HTMLCanvasElement | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const mobileUrl = computed(() => {
  const ip = localIp.value || "127.0.0.1";
  return `http://${ip}:${GO_API_PORT}/mobile`;
});

const healthUrl = computed(() => `http://127.0.0.1:${GO_API_PORT}/health`);
const wsUrl = computed(() => `ws://127.0.0.1:${GO_API_PORT}/ws/uploads`);

const allOk = computed(() => httpOk.value && wsConnected.value);

async function initQr() {
  testing.value = true;
  httpOk.value = false;
  await loadLocalIp();
  await renderQr();
  await testConnectivity();
  connectWebSocket();
}

async function loadLocalIp() {
  try {
    localIp.value = await invoke<string>("get_local_ip");
  } catch {
    localIp.value = "";
    message.warning("无法获取本机局域网 IP，请手动输入地址");
  }
}

async function renderQr() {
  await nextTick();
  if (!qrCanvas.value) return;
  try {
    await QRCode.toCanvas(qrCanvas.value, mobileUrl.value, {
      width: 220,
      margin: 2,
      color: { dark: "#1f3864", light: "#ffffff" },
    });
  } catch {
    // QR render failed
  }
}

async function testConnectivity() {
  httpOk.value = false;
  try {
    // Use Tauri command which is more reliable than fetch from webview
    const status = await invoke<{ running: boolean; healthOk: boolean; error: string }>("check_api_server");
    httpOk.value = status.healthOk;
    if (!status.healthOk && status.error) {
      console.warn("[mobile-connect]", status.error);
    }
  } catch {
    // Fallback to fetch
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(healthUrl.value, { signal: controller.signal });
      clearTimeout(timeout);
      httpOk.value = resp.ok;
    } catch {
      httpOk.value = false;
    }
  } finally {
    testing.value = false;
  }
}

function connectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    ws = new WebSocket(wsUrl.value);
    ws.onopen = () => {
      wsConnected.value = true;
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_upload" && data.path) {
          lastUpload.value = {
            path: data.path,
            filename: data.filename || "",
            time: data.time || "",
          };
          emit("new-image", data.path);
          message.success(`收到手机拍照：${data.filename}`);
        }
      } catch {
        // ignore
      }
    };
    ws.onclose = () => {
      wsConnected.value = false;
      scheduleReconnect();
    };
    ws.onerror = () => {
      wsConnected.value = false;
    };
  } catch {
    wsConnected.value = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (!props.show) return;
  reconnectTimer = setTimeout(connectWebSocket, 3000);
}

function copyUrl() {
  navigator.clipboard.writeText(mobileUrl.value).then(
    () => message.success("地址已复制"),
    () => message.warning("复制失败")
  );
}

function openInBrowser() {
  window.open(mobileUrl.value, "_blank");
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      initQr();
    } else {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
        ws = null;
      }
      wsConnected.value = false;
      httpOk.value = false;
      testing.value = true;
    }
  }
);

onBeforeUnmount(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) ws.close();
});
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    title="手机拍照传题"
    class="mobile-connect-modal"
    :style="{ maxWidth: '440px' }"
    @update:show="(val: boolean) => emit('update:show', val)"
  >
    <div class="connect-body">
      <!-- Connectivity status -->
      <div class="status-panel">
        <div v-if="testing" class="status-item">
          <Loader2 :size="14" class="spin" />
          <span>检测服务状态...</span>
        </div>
        <div v-else class="status-checks">
          <div class="status-item" :class="{ ok: httpOk, fail: !httpOk }">
            <span class="status-dot" />
            <span>API 服务</span>
            <span class="status-text">{{ httpOk ? '运行中' : '未启动' }}</span>
          </div>
          <div class="status-item" :class="{ ok: wsConnected, fail: !wsConnected }">
            <span class="status-dot" />
            <span>消息通知</span>
            <span class="status-text">{{ wsConnected ? '已连接' : '未连接' }}</span>
          </div>
          <div class="status-item ok">
            <span class="status-dot" />
            <span>本机地址</span>
            <span class="status-text ip-text">{{ localIp || '未获取到' }}</span>
          </div>
        </div>
      </div>

      <!-- Not running hint -->
      <div v-if="!testing && !httpOk" class="error-box">
        <p><strong>API 服务未运行</strong></p>
        <p>桌面端启动时应自动启动服务。如果仍未运行：</p>
        <p class="cmd">cd services/api && go run ./cmd/server</p>
        <n-button size="small" secondary @click="testConnectivity" style="margin-top:8px">
          重新检测
        </n-button>
      </div>

      <!-- Not on same LAN hint -->
      <div v-if="!testing && httpOk && !localIp" class="warn-box">
        <p><strong>未获取到局域网 IP</strong></p>
        <p>请检查网络连接。手机需与电脑在同一 WiFi 下。</p>
        <p>可尝试手动在手机浏览器输入：</p>
        <p class="cmd">http://192.168.x.x:18080/mobile</p>
      </div>

      <!-- QR Code (only show when ready) -->
      <div v-if="httpOk && localIp" class="qr-section">
        <div class="qr-wrap">
          <canvas ref="qrCanvas" width="220" height="220" />
        </div>
        <p class="qr-tip">手机相机扫码 → 浏览器打开拍照页面</p>
      </div>

      <!-- Fallback when no local IP -->
      <div v-else-if="!testing && httpOk && !localIp" class="qr-section">
        <div class="qr-wrap qr-fallback">
          <QrCode :size="80" class="qr-icon" />
          <span>无局域网 IP</span>
        </div>
      </div>

      <!-- URL row -->
      <div class="url-row" v-if="httpOk">
        <code class="url-text">{{ mobileUrl }}</code>
        <n-button text size="small" @click="copyUrl">
          <template #icon><Copy :size="14" /></template>
        </n-button>
        <n-button text size="small" @click="openInBrowser">
          <template #icon><ExternalLink :size="14" /></template>
        </n-button>
      </div>

      <!-- Recent upload -->
      <div v-if="lastUpload" class="recent-upload">
        <n-tag type="success" round size="small">
          最新上传：{{ lastUpload.filename }}
        </n-tag>
      </div>

      <!-- Troubleshooting tips -->
      <div class="tips">
        <p><strong>手机无法打开页面？</strong> 逐一检查：</p>
        <p>1️⃣ 手机和电脑连接 <strong>同一个 WiFi</strong>（不能是手机流量）</p>
        <p>2️⃣ 路由器未开启 <strong>AP 隔离</strong>（部分公共场所 Wi-Fi 会隔离设备）</p>
        <p>3️⃣ 尝试在手机浏览器<strong>手动输入</strong>上方地址</p>
        <p>4️⃣ 电脑防火墙需<strong>允许传入连接</strong>到端口 {{ GO_API_PORT }}</p>
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.connect-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 8px 0;
}

.status-panel {
  width: 100%;
  background: var(--bg-muted);
  border-radius: 10px;
  padding: 12px;
}

.status-checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  flex-shrink: 0;
}

.status-item.ok .status-dot { background: #4caf50; }
.status-item.fail .status-dot { background: #ef5350; }

.status-text {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.ip-text {
  font-family: monospace;
}

.error-box, .warn-box {
  width: 100%;
  background: #fff3e0;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.8;
  color: #e65100;
}

.error-box {
  background: #ffebee;
  color: #c62828;
}

.error-box .cmd, .warn-box .cmd {
  background: rgba(0,0,0,.06);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  display: inline-block;
}

.qr-section {
  text-align: center;
}

.qr-wrap {
  width: 220px;
  height: 220px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 12px;
  padding: 8px;
}

.qr-fallback {
  flex-direction: column;
  gap: 8px;
  color: #999;
  font-size: 12px;
}

.qr-icon {
  color: #ccc;
}

.qr-tip {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.url-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-muted);
  border-radius: 8px;
  padding: 6px 10px;
  max-width: 100%;
  overflow: hidden;
}

.url-text {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  font-family: monospace;
}

.recent-upload {
  min-height: 24px;
}

.tips {
  width: 100%;
  background: var(--bg-muted);
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.9;
}

.tips p {
  margin: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
