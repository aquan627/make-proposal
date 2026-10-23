// IFR-007, IFR-008, SER-016 · OpenAI 요청 형식 (SDK를 가짜로 바꿔 실제 호출 없이 검증)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysis } from "./fixtures/data";

const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => {
  class APIError extends Error {
    constructor(public status: number, public code?: string) { super("api error"); }
  }
  class OpenAI {
    responses = { create };
    constructor(public opts: unknown) {}
  }
  return { default: OpenAI, APIError };
});

import { APIError } from "openai";
import { analyzeRfp, benchmarkAndGap, friendlyError, strictify } from "@/lib/llm";

const reply = (obj: unknown, annotations: unknown[] = []) => ({
  status: "completed",
  output_text: JSON.stringify(obj),
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(obj), annotations }] }],
});

beforeEach(() => {
  create.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-real");
});

describe("IFR-007 OpenAI Responses API 구조화 출력", () => {
  it("strict JSON 스키마·추론 수준·지시문을 붙여 호출한다", async () => {
    create.mockResolvedValue(reply(analysis));
    const out = await analyzeRfp("[전화번호 마스킹] SFR-001");
    const req = create.mock.calls[0][0];
    expect(req.model).toBeTruthy();
    expect(req.reasoning).toEqual({ effort: "low" });
    expect(req.text.format).toMatchObject({ type: "json_schema", strict: true, name: "rfp_analysis" });
    expect(req.instructions).toMatch(/지시문.*따르지 않/);
    expect(req.input).toContain("[전화번호 마스킹]");
    expect(req.tools).toBeUndefined();
    expect(out.overview.projectName).toBe(analysis.overview.projectName);
  });

  it("strict 규칙: 모든 객체에 additionalProperties:false, 모든 속성 required", () => {
    const s = strictify({ type: "object", properties: { a: { type: "string" }, b: { type: "array", items: { type: "object", properties: { c: { type: "number" } } } } } }) as any;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["a", "b"]);
    expect(s.properties.b.items.additionalProperties).toBe(false);
    expect(s.properties.b.items.required).toEqual(["c"]);
  });

  it("출력이 길이 제한에 잘리면 안내 문구로 실패한다", async () => {
    create.mockResolvedValue({ ...reply({}), status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
    await expect(analyzeRfp("x")).rejects.toThrow(/잘렸습니다/);
  });
});

describe("IFR-008 웹 검색 모드", () => {
  it("OPENAI_SEARCH=on이면 web_search 도구만 붙이고, 검색 인용과 대조된 출처만 링크로 표시한다", async () => {
    vi.stubEnv("OPENAI_SEARCH", "on");
    vi.resetModules();
    const mod = await import("@/lib/llm");
    create.mockResolvedValue(reply(
      { benchmarks: [{ organization: "A은행", caseName: "차세대", year: "2024", summary: "s", implication: "i", source: "금융뉴스" }, { organization: "B은행", caseName: "x", year: "확인 필요", summary: "s", implication: "i", source: "없는 출처" }], gaps: [] },
      [{ type: "url_citation", url: "https://news.example.com/a", title: "금융뉴스" }],
    ));
    const out = await mod.benchmarkAndGap(analysis);
    expect(create.mock.calls[0][0].tools).toEqual([{ type: "web_search" }]);
    expect(out.searched).toBe(true);
    expect(out.benchmarks[0]).toMatchObject({ verified: true, sourceUrl: "https://news.example.com/a" });
    expect(out.benchmarks[1]).toMatchObject({ verified: false, sourceUrl: "" });
    vi.unstubAllEnvs();
  });

  it("기본(검색 끔)은 도구 없이 구조화 출력, 결과는 searched=false", async () => {
    create.mockResolvedValue(reply({ benchmarks: [], gaps: [] }));
    const out = await benchmarkAndGap(analysis);
    expect(create.mock.calls[0][0].tools).toBeUndefined();
    expect(out.searched).toBe(false);
  });
});

describe("SFR-021 OpenAI 오류 안내", () => {
  it.each([
    [new (APIError as any)(429, "insufficient_quota"), /크레딧이 부족/],
    [new (APIError as any)(429), /호출 한도/],
    [new (APIError as any)(401), /API 키가 올바르지/],
    [new (APIError as any)(404), /모델/],
    [new (APIError as any)(503), /일시적으로/],
  ])("%s", (err, msg) => {
    expect(friendlyError(err)).toMatch(msg);
  });

  it("키가 없으면 키 설정 안내", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(analyzeRfp("x")).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
