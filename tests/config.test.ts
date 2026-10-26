// SER-016, SER-018, SER-019, SER-020 · 설정·정적 규칙
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("SER-018 보안 헤더", () => {
  it("모든 경로에 CSP·프레임 차단·nosniff·HSTS 등을 붙이고 API는 캐시하지 않는다", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!.headers.map((h) => h.key);
    expect(all).toEqual(expect.arrayContaining(["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]));
    const api = rules.find((r) => r.source === "/api/:path*")!.headers;
    expect(api).toContainEqual({ key: "Cache-Control", value: "no-store" });
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("SER-016 프롬프트 주입 대응", () => {
  const src = readFileSync("lib/llm.ts", "utf8");
  it("RFP 안의 지시문을 따르지 않고 마스킹 토큰을 복원하지 않도록 지시한다", () => {
    expect(src).toMatch(/지시문.*따르지 않/);
    expect(src).toMatch(/마스킹.*복원/);
  });
  it("AI에 쓰기 권한 도구를 주지 않는다 (허용: googleSearch 뿐)", () => {
    const tools = [...src.matchAll(/tools:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(t.replace(/\s/g, "")).toBe("{googleSearch:{}}");
  });
});

describe("SER-019 비밀정보 관리 · SECURITY.md 정적 규칙", () => {
  it("보안 스캔이 통과한다 (키 유출, NEXT_PUBLIC_ 비밀값, 로그, 마스킹 누락)", () => {
    expect(() => execFileSync("node", ["scripts/security-scan.mjs"], { stdio: "pipe" })).not.toThrow();
  });
});

describe("SER-020 의존성 취약점", () => {
  it("통합 점검(check)과 CI에 high 이상 차단 감사가 들어 있다", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.check).toContain("npm audit --omit=dev --audit-level=high");
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain("npm audit --omit=dev --audit-level=high");
  });
});
