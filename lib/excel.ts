import ExcelJS from "exceljs";
import type { Analysis, BenchmarkResult } from "./types";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
const LABEL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFC8D2" } },
  left: { style: "thin", color: { argb: "FFBFC8D2" } },
  bottom: { style: "thin", color: { argb: "FFBFC8D2" } },
  right: { style: "thin", color: { argb: "FFBFC8D2" } },
};
const FONT = "맑은 고딕";

type Col = { header: string; key: string; width: number };

function table(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 14, bold: true, color: { argb: "FF1F3A5F" } };
  ws.getRow(1).height = 26;

  const header = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER;
  });
  header.height = 22;

  rows.forEach((r) => {
    const row = ws.addRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = BORDER;
    });
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cols.length } };
  return ws;
}

export async function buildWorkbook(a: Analysis, b: BenchmarkResult | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RFP Analyzer";

  // 1. 사업개요
  const o = a.overview;
  const ws = wb.addWorksheet("1.사업개요");
  ws.columns = [{ width: 18 }, { width: 100 }];
  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = `사업개요 — ${o.projectName}`;
  ws.getCell("A1").font = { name: FONT, size: 14, bold: true, color: { argb: "FF1F3A5F" } };
  const pairs: [string, string][] = [
    ["사업명", o.projectName],
    ["발주기관", o.client],
    ["사업기간", o.period],
    ["사업예산", o.budget],
    ["추진배경", o.background],
    ["사업목적", o.purpose],
    ["사업목표", o.goals.map((g) => `• ${g}`).join("\n")],
    ["사업범위", o.scope.map((s) => `• ${s}`).join("\n")],
    ["기대효과(정량)", o.expectedEffects.filter((e) => e.type === "정량").map((e) => `• ${e.effect}`).join("\n") || "-"],
    ["기대효과(정성)", o.expectedEffects.filter((e) => e.type !== "정량").map((e) => `• ${e.effect}`).join("\n") || "-"],
  ];
  pairs.forEach(([k, v], i) => {
    const row = ws.getRow(i + 3);
    row.getCell(1).value = k;
    row.getCell(2).value = v;
    row.getCell(1).fill = LABEL_FILL;
    row.getCell(1).font = { name: FONT, bold: true };
    row.getCell(2).font = { name: FONT, size: 10 };
    row.getCell(1).alignment = { vertical: "top" };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
    row.getCell(1).border = BORDER;
    row.getCell(2).border = BORDER;
    const lines = String(v).split("\n").length;
    row.height = Math.max(20, Math.min(lines, 12) * 15);
  });

  // 2. 요구사항 분석
  table(wb, "2.요구사항분석", "요구사항 분석", [
    { header: "요구사항 ID", key: "id", width: 13 },
    { header: "분류", key: "category", width: 12 },
    { header: "요구사항명", key: "name", width: 26 },
    { header: "상세내용", key: "description", width: 55 },
    { header: "중요도", key: "priority", width: 8 },
    { header: "난이도", key: "difficulty", width: 8 },
    { header: "대응방안", key: "response", width: 50 },
  ], a.requirements);

  // 3. AS-IS
  table(wb, "3.AS-IS분석", "현행(AS-IS) 분석 — RFP 기준", [
    { header: "영역", key: "area", width: 18 },
    { header: "현행 현황", key: "current", width: 50 },
    { header: "문제점·한계", key: "issue", width: 45 },
    { header: "확인 필요사항", key: "toConfirm", width: 40 },
  ], a.asis);

  // 4. 벤치마킹
  table(wb, "4.벤치마킹", "동종업계 벤치마킹", [
    { header: "기관", key: "organization", width: 16 },
    { header: "사례", key: "caseName", width: 28 },
    { header: "연도", key: "year", width: 8 },
    { header: "사례 요약", key: "summary", width: 50 },
    { header: "본 사업 시사점", key: "implication", width: 45 },
    { header: "출처", key: "sourceUrl", width: 40 },
    { header: "출처 검증", key: "verified", width: 10 },
  ], (b?.benchmarks ?? []).map((x) => ({ ...x, verified: x.verified ? "검색 확인" : "확인 필요" })));

  // 5. 갭 분석
  table(wb, "5.갭분석", "갭(Gap) 분석", [
    { header: "영역", key: "area", width: 16 },
    { header: "AS-IS", key: "asis", width: 35 },
    { header: "TO-BE", key: "tobe", width: 35 },
    { header: "참고 사례", key: "benchmark", width: 18 },
    { header: "Gap", key: "gap", width: 35 },
    { header: "개선과제", key: "task", width: 35 },
    { header: "우선순위", key: "priority", width: 9 },
  ], b?.gaps ?? []);

  // 6. 추진전략
  table(wb, "6.추진전략", "추진전략", [
    { header: "No", key: "no", width: 5 },
    { header: "추진전략", key: "strategy", width: 24 },
    { header: "세부 내용", key: "description", width: 60 },
    { header: "연계 요구사항", key: "linkedRequirements", width: 22 },
    { header: "차별화 포인트", key: "differentiation", width: 45 },
  ], a.strategies.map((s, i) => ({ no: i + 1, ...s })));

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
