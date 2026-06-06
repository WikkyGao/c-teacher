import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthSession, getAuthSession, saveAuthSession } from "./authSession";

describe("authSession", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    });
    localStorage.clear();
  });

  it("starts without an active teacher session", () => {
    expect(getAuthSession()).toEqual({
      isAuthenticated: false,
      teacherName: ""
    });
  });

  it("saves and trims a teacher session", () => {
    saveAuthSession("  王老师  ");

    expect(getAuthSession()).toEqual({
      isAuthenticated: true,
      teacherName: "王老师"
    });
  });

  it("clears the active teacher session", () => {
    saveAuthSession("王老师");
    clearAuthSession();

    expect(getAuthSession()).toEqual({
      isAuthenticated: false,
      teacherName: ""
    });
  });
});
