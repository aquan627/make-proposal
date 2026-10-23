// SER-007, SFR-001 · 화면·API 접근 제어
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { AUTH_COOKIE, createSession } from "@/lib/auth";

afterEach(() => vi.unstubAllEnvs());
const req = (path: string, cookie?: string) => new NextRequest(`https://rfp.test${path}`, { headers: cookie ? { cookie: `${AUTH_COOKIE}=${cookie}` } : {} });

describe("SER-007 앱 잠금", () => {
  it("비밀번호 미설정이면 API 503, 화면은 설정 안내로 이동", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect((await proxy(req("/api/analyze"))).status).toBe(503);
    expect((await proxy(req("/"))).headers.get("location")).toContain("/login?setup=1");
  });
});

describe("SFR-001 로그인 보호", () => {
  it("로그인 전에는 API 401, 화면은 로그인 페이지로", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    expect((await proxy(req("/api/market"))).status).toBe(401);
    expect((await proxy(req("/"))).headers.get("location")).toMatch(/\/login$/);
  });

  it("유효한 세션이면 통과한다", async () => {
    vi.stubEnv("APP_PASSWORD", "hackathon-2026");
    const res = await proxy(req("/api/analyze", await createSession()));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
