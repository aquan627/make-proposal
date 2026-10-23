// SER-007, SER-008 · 비밀번호와 세션
import { afterEach, describe, expect, it, vi } from "vitest";
import { authConfigured, checkPassword, createSession, verifySession } from "@/lib/auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("SER-007 앱 잠금", () => {
  it("APP_PASSWORD가 없거나 8자 미만이면 잠긴 상태다", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("APP_PASSWORD", "short");
    expect(authConfigured()).toBe(false);
  });
});

describe("SER-008 세션", () => {
  it("올바른 비밀번호만 통과한다", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    expect(await checkPassword("hackathon-2026")).toBe(true);
    expect(await checkPassword("wrong-password")).toBe(false);
    expect(await checkPassword(undefined)).toBe(false);
  });

  it("발급한 세션은 유효하고, 위조·만료 세션은 거절한다", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    const token = await createSession();
    expect(token).not.toContain("hackathon-2026");
    expect(await verifySession(token)).toBe(true);
    expect(await verifySession(token.replace(/.$/, (c) => (c === "a" ? "b" : "a")))).toBe(false);
    expect(await verifySession("9999999999999.abcd")).toBe(false);
    expect(await verifySession(undefined)).toBe(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 13 * 3600 * 1000);
    expect(await verifySession(token)).toBe(false);
  });

  it("비밀번호를 바꾸면 기존 세션이 무효가 된다", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    const token = await createSession();
    vi.stubEnv("APP_PASSWORD", "changed-password");
    expect(await verifySession(token)).toBe(false);
  });
});
