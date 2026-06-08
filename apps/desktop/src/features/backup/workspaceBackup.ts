import type {
  AppSettings,
  ClassRecord,
  MaterialSource,
  PersistedState,
  ReminderItem,
  ScheduledLesson,
  Student,
  TeachingMaterial
} from "../students/studentStore";

export const BACKUP_VERSION = 1;

export type WorkspaceBackup = {
  version: number;
  exportedAt: string;
  state: PersistedState;
};

export type WorkspaceStoreSnapshot = {
  items: Student[];
  materials: TeachingMaterial[];
  materialSources: MaterialSource[];
  classRecords: ClassRecord[];
  reminders: ReminderItem[];
  scheduledLessons: ScheduledLesson[];
  appSettings: AppSettings;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function workspaceStateFromStore(workspace: WorkspaceStoreSnapshot): PersistedState {
  return {
    students: clone(workspace.items),
    materials: clone(workspace.materials),
    materialSources: clone(workspace.materialSources),
    classRecords: clone(workspace.classRecords),
    reminders: clone(workspace.reminders),
    scheduledLessons: clone(workspace.scheduledLessons),
    appSettings: clone(workspace.appSettings)
  };
}

export function buildWorkspaceBackup(state: PersistedState, exportedAt = Math.floor(Date.now() / 1000)): WorkspaceBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toString(),
    state: clone(state)
  };
}

export function backupBlobFromStore(workspace: WorkspaceStoreSnapshot): Blob {
  const backup = buildWorkspaceBackup(workspaceStateFromStore(workspace));
  return new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
}

export function triggerBackupDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isWorkspaceBackup(raw: unknown): raw is WorkspaceBackup {
  if (!raw || typeof raw !== "object") return false;
  const backup = raw as Record<string, unknown>;
  if (backup.version !== BACKUP_VERSION) return false;
  if (typeof backup.exportedAt !== "string" && typeof backup.exported_at !== "string") return false;
  if (!backup.state || typeof backup.state !== "object") return false;

  const state = backup.state as Record<string, unknown>;
  return (
    Array.isArray(state.students) &&
    Array.isArray(state.materials) &&
    Array.isArray(state.materialSources) &&
    Array.isArray(state.classRecords) &&
    Array.isArray(state.reminders) &&
    Array.isArray(state.scheduledLessons) &&
    Boolean(state.appSettings) &&
    typeof state.appSettings === "object"
  );
}

export async function parseWorkspaceBackupFile(file: File): Promise<WorkspaceBackup> {
  const raw: unknown = JSON.parse(await file.text());
  if (!isWorkspaceBackup(raw)) {
    throw new Error("备份文件格式无效或版本不兼容");
  }
  return raw;
}

export function backupFilename(date = new Date()) {
  return `c-teacher-${date.toISOString().slice(0, 10)}.json`;
}
