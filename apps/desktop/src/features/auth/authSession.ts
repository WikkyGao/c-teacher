export type AuthSession = {
  isAuthenticated: boolean;
  teacherName: string;
};

const authStorageKey = "c-teacher.auth.v1";

export function getAuthSession(): AuthSession {
  if (typeof localStorage === "undefined") {
    return {
      isAuthenticated: false,
      teacherName: ""
    };
  }

  const teacherName = localStorage.getItem(authStorageKey)?.trim() ?? "";
  return {
    isAuthenticated: teacherName.length > 0,
    teacherName
  };
}

export function saveAuthSession(teacherName: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(authStorageKey, teacherName.trim());
}

export function clearAuthSession() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(authStorageKey);
}
