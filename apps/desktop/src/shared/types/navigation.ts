export type NavKey =
  | "dashboard"
  | "students"
  | "schedule"
  | "records"
  | "materials"
  | "reminders"
  | "mobile"
  | "diagnostics"
  | "settings"
  | "backup";

export type NavItem = {
  key: NavKey;
  label: string;
};

export const navItems: NavItem[] = [
  { key: "dashboard", label: "工作台" },
  { key: "students", label: "学生管理" },
  { key: "schedule", label: "课程表" },
  { key: "records", label: "课堂记录" },
  { key: "materials", label: "资料库" },
  { key: "reminders", label: "提醒" }
];

export const settingsNavItem: NavItem = { key: "settings", label: "App 设置" };
