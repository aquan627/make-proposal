// IFR-001, SER-008, SER-009 · 로그인 API
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/login/route";
import { jsonRequest } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

describe("IFR-001 /api/login", () => {
  it("성공 시 HttpOnly·Secure·SameSite=Strict 쿠키를 준다", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    const res = await login(jsonRequest("/api/login", { password: "hackathon-2026" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).not.toContain("hackathon-2026");
  });

  it("틀린 비밀번호는 401", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    expect((await login(jsonRequest("/api/login", { password: "nope" }))).status).toBe(401);
  });
});
