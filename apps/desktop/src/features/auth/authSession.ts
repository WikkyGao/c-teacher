export type UserRole = "teacher" | "parent";

export type AuthSession = {
  isAuthenticated: boolean;
  role: UserRole;
  userName: string;
};

const authStorageKey = "c-teacher.auth.v1";

export function getAuthSession(): AuthSession {
  if (typeof localStorage === "undefined") {
    return { isAuthenticated: false, role: "teacher", userName: "" };
  }

  const raw = localStorage.getItem(authStorageKey)?.trim() ?? "";
  if (!raw) return { isAuthenticated: false, role: "teacher", userName: "" };

  try {
    const parsed = JSON.parse(raw) as { r: UserRole; n: string };
    return {
      isAuthenticated: parsed.n.length > 0,
      role: parsed.r === "parent" ? "parent" : "teacher",
      userName: parsed.n
    };
  } catch {
    // legacy format: plain teacher name string
    const name = raw;
    return {
      isAuthenticated: name.length > 0,
      role: "teacher",
      userName: name
    };
  }
}

export function saveAuthSession(userName: string, role: UserRole = "teacher") {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(authStorageKey, JSON.stringify({ r: role, n: userName.trim() }));
}

export function clearAuthSession() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(authStorageKey);
}
