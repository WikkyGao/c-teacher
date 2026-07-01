import type { UserRole } from "../../features/auth/authSession";

export function childLabel(role?: UserRole): string {
  return role === "teacher" ? "学生" : "小孩";
}
