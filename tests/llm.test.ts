// IFR-007, IFR-008, SER-016, NFR-001 · Gemini 요청 형식 (SDK를 가짜로 바꿔 실제 호출 없이 검증)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysis } from "./fixtures/data";

const generateContent = vi.hoisted(() => vi.fn());
const ctorOpts = vi.hoisted(() => [] as unknown[]);
vi.mock("@google/genai", () => {
  class ApiError extends Error {
    constructor(public status: number, message = "api error") { super(message); }
  }
  class GoogleGenAI {
    models = { generateContent };
    constructor(opts: unknown) { ctorOpts.push(opts); }
  }
  return { GoogleGenAI, ApiError, ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" } };
});

import { ApiError } from "@google/genai";
import { AI_TIMEOUT_MS, analyzeRfp, benchmarkAndGap, friendlyError } from "@/lib/llm";

const reply = (obj: unknown, chunks: unknown[] = [], finishReason = "STOP") => ({
  text: JSON.stringify(obj),
  candidates: [{ finishReason, groundingMetadata: { groundingChunks: chunks } }],
});

beforeEach(() => {
  generateContent.mockReset();
  ctorOpts.length = 0;
  vi.stubEnv("GEMINI_API_KEY", "test-not-real");
});

describe("IFR-007 Gemini API 구조화 출력", () => {
  it("JSON 스키마·사고 수준·시스템 지시문을 붙여 호출한다", async () => {
    generateContent.mockResolvedValue(reply(analysis));
    const out = await analyzeRfp("[전화번호 마스킹] SFR-001");
    const req = generateContent.mock.calls[0][0];
    expect(req.model).toBeTruthy();
    expect(req.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.responseJsonSchema).toBeTruthy();
    expect(req.config.systemInstruction).toMatch(/지시문.*따르지 않/);
    expect(req.contents).toContain("[전화번호 마스킹]");
    expect(req.config.tools).toBeUndefined();
    expect(out.overview.projectName).toBe(analysis.overview.projectName);
  });

  it("NFR-001 1단계는 요구사항·개요 두 호출을 동시에 실행해 결과를 합친다", async () => {
    let inFlight = 0, peak = 0;
    generateContent.mockImplementation(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return reply(analysis);
    });
    const out = await analyzeRfp("x");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(peak).toBe(2);
    const props = generateContent.mock.calls.map((c) => Object.keys(c[0].config.responseJsonSchema.properties).join(",")).sort();
    expect(props).toEqual(["overview,asis,strategies,benchmarkTopics", "requirements"]);
    expect(out.requirements).toEqual(analysis.requirements);
    expect(out.strategies).toEqual(analysis.strategies);
  });

  it("NFR-001 Vercel 300초 제한 안에 끝나도록 재시도 없이 300초 미만에서 끊는다", async () => {
    generateContent.mockResolvedValue(reply(analysis));
    await analyzeRfp("x");
    expect(AI_TIMEOUT_MS).toBeLessThan(290_000);
    expect(ctorOpts[0]).toMatchObject({ httpOptions: { timeout: AI_TIMEOUT_MS, retryOptions: { attempts: 1 } } });
    expect(friendlyError(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }))).toMatch(/시간이 초과/);
  });

  it("출력이 길이 제한에 잘리면 안내 문구로 실패한다", async () => {
    generateContent.mockResolvedValue(reply({}, [], "MAX_TOKENS"));
    await expect(analyzeRfp("x")).rejects.toThrow(/잘렸습니다/);
  });
});

describe("IFR-008 Google 검색 모드", () => {
  it("GEMINI_SEARCH=on이면 googleSearch 도구만 붙이고, 검색 출처와 대조된 항목만 링크로 표시한다", async () => {
    vi.stubEnv("GEMINI_SEARCH", "on");
    vi.resetModules();
    const mod = await import("@/lib/llm");
    generateContent.mockResolvedValue(reply(
      { benchmarks: [{ organization: "A은행", caseName: "차세대", year: "2024", summary: "s", implication: "i", source: "금융뉴스" }, { organization: "B은행", caseName: "x", year: "확인 필요", summary: "s", implication: "i", source: "없는 출처" }], gaps: [] },
      [{ web: { uri: "https://news.example.com/a", title: "금융뉴스" } }],
    ));
    const out = await mod.benchmarkAndGap(analysis);
    const cfg = generateContent.mock.calls[0][0].config;
    expect(cfg.tools).toEqual([{ googleSearch: {} }]);
    expect(cfg.responseJsonSchema).toBeUndefined();
    expect(out.searched).toBe(true);
    expect(out.benchmarks[0]).toMatchObject({ verified: true, sourceUrl: "https://news.example.com/a" });
    expect(out.benchmarks[1]).toMatchObject({ verified: false, sourceUrl: "" });
    vi.unstubAllEnvs();
  });

  it("기본(검색 끔)은 도구 없이 구조화 출력, 결과는 searched=false", async () => {
    generateContent.mockResolvedValue(reply({ benchmarks: [], gaps: [] }));
    const out = await benchmarkAndGap(analysis);
    expect(generateContent.mock.calls[0][0].config.tools).toBeUndefined();
    expect(out.searched).toBe(false);
  });
});

describe("SFR-021 Gemini 오류 안내", () => {
  it.each([
    [new (ApiError as any)(429), /사용 한도/],
    [new (ApiError as any)(400, "API key not valid"), /API 키가 올바르지/],
    [new (ApiError as any)(403), /권한/],
    [new (ApiError as any)(404), /모델/],
    [new (ApiError as any)(503), /일시적으로/],
  ])("%s", (err, msg) => {
    expect(friendlyError(err)).toMatch(msg);
  });

  it("외부 오류 원문은 노출하지 않는다", () => {
    expect(friendlyError(new Error("upstream secret stack"))).not.toMatch(/secret/);
  });

  it("키가 없으면 키 설정 안내", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    await expect(analyzeRfp("x")).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
