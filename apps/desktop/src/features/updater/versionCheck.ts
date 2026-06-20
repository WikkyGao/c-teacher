import { isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { reactive } from "vue";

const DISMISSED_KEY = "c-teacher.dismissed-version";
const GITEE_REPO_OWNER = "saugage";
const GITEE_REPO_NAME = "c-teacher";

export type UpdateStatus = "idle" | "checking" | "latest" | "available" | "error";

export type UpdateState = {
  status: UpdateStatus;
  localVersion: string;
  latestVersion: string;
  downloadUrl: string;
  errorMessage: string;
};

export const updateState = reactive<UpdateState>({
  status: "idle",
  localVersion: "",
  latestVersion: "",
  downloadUrl: "",
  errorMessage: "",
});

export async function getLocalVersion(): Promise<string> {
  if (!isTauri()) return "0.1.0";
  try {
    return await invoke<string>("get_app_version");
  } catch {
    return "0.1.0";
  }
}

export async function fetchGiteeLatestVersion(): Promise<{ version: string; downloadUrl: string } | null> {
  const url = `https://gitee.com/api/v5/repos/${GITEE_REPO_OWNER}/${GITEE_REPO_NAME}/releases/latest`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    const tagName = data.tag_name as string;
    if (!tagName) return null;
    const clean = tagName.replace(/^v/i, "");
    return {
      version: clean,
      downloadUrl: `https://gitee.com/${GITEE_REPO_OWNER}/${GITEE_REPO_NAME}/releases/tag/${tagName}`,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((part) => {
      const n = parseInt(part, 10);
      return isNaN(n) ? 0 : n;
    });
}

export function compareVersions(current: string, latest: string): number {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function getDismissedVersion(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setDismissedVersion(version: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // localStorage unavailable, ignore
  }
}

export async function checkForUpdates(): Promise<void> {
  updateState.status = "checking";
  updateState.errorMessage = "";

  try {
    updateState.localVersion = await getLocalVersion();
    const remote = await fetchGiteeLatestVersion();
    if (!remote) {
      updateState.status = "error";
      updateState.errorMessage = "无法获取最新版本信息，请检查网络连接";
      return;
    }

    updateState.latestVersion = remote.version;
    updateState.downloadUrl = remote.downloadUrl;

    const diff = compareVersions(updateState.localVersion, updateState.latestVersion);
    updateState.status = diff > 0 ? "available" : "latest";
  } catch {
    updateState.status = "error";
    updateState.errorMessage = "检查更新失败";
  }
}

export async function checkSilent(): Promise<void> {
  const dismissed = getDismissedVersion();
  updateState.localVersion = await getLocalVersion();
  const remote = await fetchGiteeLatestVersion();
  if (!remote) return;

  updateState.latestVersion = remote.version;
  updateState.downloadUrl = remote.downloadUrl;

  const diff = compareVersions(updateState.localVersion, updateState.latestVersion);
  if (diff > 0 && remote.version !== dismissed) {
    updateState.status = "available";
  }
}
