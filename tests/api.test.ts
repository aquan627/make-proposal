// IFR-003~006, SER-002~006, NFR-003 · API 동작 (가짜 LLM로 실제 외부 호출 없이 검증)
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysis, bench, market, SAMPLE_TEXT } from "./fixtures/data";
import { jsonRequest, readStreamJson } from "./helpers";

const llm = vi.hoisted(() => ({
  analyzeRfp: vi.fn(),
  benchmarkAndGap: vi.fn(),
  marketAnalysis: vi.fn(),
  friendlyError: (e: unknown) => (e instanceof Error && /[가-힣]/.test(e.message) ? e.message : "처리 중 오류가 발생했습니다."),
}));
vi.mock("@/lib/llm", () => llm);

import { POST as analyze } from "@/app/api/analyze/route";
import { POST as benchmark } from "@/app/api/benchmark/route";
import { POST as marketRoute } from "@/app/api/market/route";
import { POST as excel } from "@/app/api/excel/route";

const PII = /010-1234-5678|010-9999-8888|pm@hanbit|10\.20\.30\.40|110-123-456789|홍길동|김철수/;

beforeEach(() => {
  vi.clearAllMocks();
  llm.analyzeRfp.mockResolvedValue(analysis);
  llm.benchmarkAndGap.mockResolvedValue(bench);
  llm.marketAnalysis.mockResolvedValue(market);
});

describe("IFR-003 /api/analyze", () => {
  it("SER-004 동의 없이 요청하면 400, AI를 호출하지 않는다", async () => {
    const res = await analyze(jsonRequest("/api/analyze", { text: SAMPLE_TEXT }));
    expect(res.status).toBe(400);
    expect(llm.analyzeRfp).not.toHaveBeenCalled();
  });

  it("SER-002 텍스트를 서버에서 다시 마스킹한 뒤 AI로 보낸다 (NFR-003 스트리밍 응답)", async () => {
    const res = await analyze(jsonRequest("/api/analyze", { text: SAMPLE_TEXT, consent: true }));
    const body = await readStreamJson(res);
    const sent = llm.analyzeRfp.mock.calls[0][0] as string;
    expect(sent).not.toMatch(PII);
    expect(sent).toContain("SFR-001");
    expect(sent).toContain("85억원");
    expect(body.overview.projectName).toBe(analysis.overview.projectName);
    expect(body.maskedCount).toBeGreaterThanOrEqual(6);
  });

  it("SER-003 PDF는 텍스트만 추출·마스킹해서 보내고 원본 바이트는 보내지 않는다", async () => {
    const pdf = readFileSync("tests/fixtures/sample-rfp.pdf").toString("base64");
    const res = await analyze(jsonRequest("/api/analyze", { pdfBase64: pdf, consent: true }));
    await readStreamJson(res);
    const sent = llm.analyzeRfp.mock.calls[0][0] as string;
    expect(sent).toContain("SFR-001");
    expect(sent).not.toMatch(/010-1234-5678|pm@bank|10\.0\.0\.12/);
    expect(sent).not.toContain(pdf.slice(0, 40));
  });

  it("SER-012 PDF가 아닌 파일은 400", async () => {
    const res = await analyze(jsonRequest("/api/analyze", { pdfBase64: Buffer.from("hello").toString("base64"), consent: true }));
    expect(res.status).toBe(400);
  });

  it("SER-012 15만 자를 넘는 텍스트는 거절한다", async () => {
    const res = await analyze(jsonRequest("/api/analyze", { text: "가".repeat(150_001), consent: true }));
    const body = await readStreamJson(res);
    expect(body.error).toMatch(/너무 깁니다/);
    expect(llm.analyzeRfp).not.toHaveBeenCalled();
  });

  it("SER-015 AI 오류 원문은 화면 문구로 바뀐다", async () => {
    llm.analyzeRfp.mockRejectedValue(new Error("upstream secret stack trace"));
    const body = await readStreamJson(await analyze(jsonRequest("/api/analyze", { text: "SFR-001", consent: true })));
    expect(body.error).not.toContain("secret");
  });

  it("SER-011 다른 출처 요청은 403", async () => {
    const res = await analyze(jsonRequest("/api/analyze", { text: "x", consent: true }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });
});

describe("IFR-004 /api/benchmark · IFR-005 /api/market", () => {
  it("SER-002 1단계 결과 안의 개인정보도 다시 마스킹한다", async () => {
    await readStreamJson(await benchmark(jsonRequest("/api/benchmark", { analysis })));
    expect(JSON.stringify(llm.benchmarkAndGap.mock.calls[0][0])).not.toMatch(PII);
  });

  it("SER-002 제안사 정보 입력란도 마스킹한다", async () => {
    const body = await readStreamJson(await marketRoute(jsonRequest("/api/market", { analysis, company: "담당자: 홍길동 010-1234-5678" })));
    const [sentAnalysis, sentCompany] = llm.marketAnalysis.mock.calls[0];
    expect(JSON.stringify(sentAnalysis) + sentCompany).not.toMatch(PII);
    expect(body.swot.strengths).toEqual(market.swot.strengths);
  });

  it("SER-012 제안사 정보 4,000자 초과는 413", async () => {
    const res = await marketRoute(jsonRequest("/api/market", { analysis, company: "가".repeat(4001) }));
    expect(res.status).toBe(413);
  });

  it("형식이 잘못된 1단계 결과는 400", async () => {
    expect((await benchmark(jsonRequest("/api/benchmark", { analysis: {} }))).status).toBe(400);
    expect((await marketRoute(jsonRequest("/api/market", { analysis: {} }))).status).toBe(400);
  });
});

describe("IFR-006 /api/excel · SFR-020", () => {
  async function workbook(payload: unknown) {
    const res = await excel(jsonRequest("/api/excel", payload));
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.arrayBuffer()) as never);
    return wb;
  }

  it("10개 시트를 순서대로 만든다", async () => {
    const wb = await workbook({ analysis, bench, market });
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "1.사업개요", "2.요구사항분석", "3.AS-IS분석", "4.시장트렌드", "5.고객니즈",
      "6.경쟁사분석", "7.SWOT", "8.벤치마킹", "9.갭분석", "10.추진전략",
    ]);
  });

  it("시장 분석이 실패해도 나머지 6개 시트로 만든다 (NFR-004)", async () => {
    const wb = await workbook({ analysis, bench: null, market: null });
    expect(wb.worksheets.length).toBe(6);
  });

  it("SER-014 수식처럼 보이는 값은 문자로 고정한다", async () => {
    const wb = await workbook({ analysis, bench, market });
    const cell = wb.getWorksheet("2.요구사항분석")!.getCell("D4");
    expect(typeof cell.value).toBe("string");
    expect(String(cell.value).startsWith("'=")).toBe(true);
  });

  it("SER-017 검색 미사용 시 시장 시트 제목에 AI 추정 표시", async () => {
    const wb = await workbook({ analysis, bench, market });
    expect(String(wb.getWorksheet("6.경쟁사분석")!.getCell("A1").value)).toMatch(/AI 추정/);
  });
});
