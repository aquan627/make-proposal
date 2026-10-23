import ExcelJS from "exceljs";
import type { Analysis, BenchmarkResult, MarketResult } from "./types";

const NAVY = "FF1F3A5F";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
const LABEL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF5" } };
const SWOT_FILL: Record<string, string> = { S: "FFE3F0E8", W: "FFFBEDE6", O: "FFE6EEF8", T: "FFF6EFE0" };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFBFC8D2" } },
  left: { style: "thin", color: { argb: "FFBFC8D2" } },
  bottom: { style: "thin", color: { argb: "FFBFC8D2" } },
  right: { style: "thin", color: { argb: "FFBFC8D2" } },
};
const FONT = "맑은 고딕";

type Col = { header: string; key: string; width: number };

// 엑셀 수식으로 해석될 수 있는 값(=, +, @ 로 시작)은 문자로 고정
function cellText(v: unknown) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return /^[=+@]/.test(s) ? "'" + s : s;
}
function clean<T extends object>(rows: T[] | undefined): Record<string, unknown>[] {
  return (rows ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? v : cellText(v)])));
}
const bullets = (arr: string[] | undefined) => (arr ?? []).map((x) => `• ${x}`).join("\n") || "-";

function sheet(wb: ExcelJS.Workbook, name: string, title: string, widths: number[], freezeRow?: number) {
  const ws = wb.addWorksheet(name, freezeRow ? { views: [{ state: "frozen", ySplit: freezeRow }] } : undefined);
  ws.columns = widths.map((w) => ({ width: w }));
  ws.mergeCells(1, 1, 1, widths.length);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 14, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = 26;
  return ws;
}

// startRow에 표를 그리고, 다음에 쓸 수 있는 행 번호를 돌려줌
function writeTable(ws: ExcelJS.Worksheet, startRow: number, cols: Col[], rows: Record<string, unknown>[], filter = true) {
  const header = ws.getRow(startRow);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER;
  });
  header.height = 22;
  rows.forEach((r, idx) => {
    const row = ws.getRow(startRow + 1 + idx);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = (r[c.key] ?? "") as ExcelJS.CellValue;
      cell.font = { name: FONT, size: 10 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = BORDER;
    });
  });
  if (filter && rows.length) ws.autoFilter = { from: { row: startRow, column: 1 }, to: { row: startRow, column: cols.length } };
  return startRow + rows.length + 2;
}

function table(wb: ExcelJS.Workbook, name: string, title: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = sheet(wb, name, title, cols.map((c) => c.width), 3);
  writeTable(ws, 3, cols, rows);
  return ws;
}

function sectionTitle(ws: ExcelJS.Worksheet, row: number, text: string) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { name: FONT, size: 12, bold: true, color: { argb: NAVY } };
}

function kv(ws: ExcelJS.Worksheet, startRow: number, pairs: [string, string][], valueCols = 1) {
  pairs.forEach(([k, v], i) => {
    const r = startRow + i;
    if (valueCols > 1) ws.mergeCells(r, 2, r, 1 + valueCols);
    const row = ws.getRow(r);
    row.getCell(1).value = k;
    row.getCell(2).value = cellText(v);
    row.getCell(1).fill = LABEL_FILL;
    row.getCell(1).font = { name: FONT, bold: true };
    row.getCell(2).font = { name: FONT, size: 10 };
    row.getCell(1).alignment = { vertical: "top" };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
    row.getCell(1).border = BORDER;
    row.getCell(2).border = BORDER;
    row.height = Math.max(20, Math.min(String(v).split("\n").length, 12) * 15);
  });
  return startRow + pairs.length + 1;
}

export async function buildWorkbook(a: Analysis, b: BenchmarkResult | null, m: MarketResult | null = null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RFP Analyzer";
  const estimated = m && !m.searched ? " (웹 검색 미사용 — 수치는 AI 추정, 출처 확인 필요)" : "";

  // 1. 사업개요
  const o = a.overview;
  const ws1 = sheet(wb, "1.사업개요", `사업개요 — ${o.projectName}`, [18, 100]);
  kv(ws1, 3, [
    ["사업명", o.projectName],
    ["발주기관", o.client],
    ["사업기간", o.period],
    ["사업예산", o.budget],
    ["추진배경", o.background],
    ["사업목적", o.purpose],
    ["사업목표", bullets(o.goals)],
    ["사업범위", bullets(o.scope)],
    ["기대효과(정량)", bullets(o.expectedEffects.filter((e) => e.type === "정량").map((e) => e.effect))],
    ["기대효과(정성)", bullets(o.expectedEffects.filter((e) => e.type !== "정량").map((e) => e.effect))],
  ]);

  // 2. 요구사항 분석
  table(wb, "2.요구사항분석", "요구사항 분석", [
    { header: "요구사항 ID", key: "id", width: 13 },
    { header: "분류", key: "category", width: 12 },
    { header: "요구사항명", key: "name", width: 26 },
    { header: "상세내용", key: "description", width: 55 },
    { header: "중요도", key: "priority", width: 8 },
    { header: "난이도", key: "difficulty", width: 8 },
    { header: "대응방안", key: "response", width: 50 },
  ], clean(a.requirements));

  // 3. AS-IS
  table(wb, "3.AS-IS분석", "현행(AS-IS) 분석 — RFP 기준", [
    { header: "영역", key: "area", width: 18 },
    { header: "현행 현황", key: "current", width: 50 },
    { header: "문제점·한계", key: "issue", width: 45 },
    { header: "확인 필요사항", key: "toConfirm", width: 40 },
  ], clean(a.asis));

  if (m) {
    // 4. 시장 트렌드
    const ws4 = sheet(wb, "4.시장트렌드", `시장 트렌드 분석${estimated}`, [20, 26, 50, 8, 50]);
    sectionTitle(ws4, 3, "시장 개요");
    let r = kv(ws4, 4, [
      ["시장", m.market.name],
      ["시장 정의", m.market.definition],
      ["시장 규모", m.market.size],
      ["성장성", m.market.growth],
      ["근거·확인 자료", m.market.basis],
    ], 4);
    sectionTitle(ws4, r, "주요 트렌드");
    writeTable(ws4, r + 1, [
      { header: "No", key: "no", width: 20 },
      { header: "트렌드", key: "trend", width: 26 },
      { header: "내용", key: "description", width: 50 },
      { header: "영향도", key: "impact", width: 8 },
      { header: "본 사업 시사점", key: "implication", width: 50 },
    ], clean(m.trends).map((t, i) => ({ no: i + 1, ...t })), false);

    // 5. 고객 니즈
    table(wb, "5.고객니즈", "대고객 시장 니즈 분석", [
      { header: "고객군", key: "segment", width: 16 },
      { header: "니즈", key: "need", width: 36 },
      { header: "현재 불편(Pain Point)", key: "painPoint", width: 40 },
      { header: "중요도", key: "priority", width: 8 },
      { header: "제안 반영 방안", key: "response", width: 45 },
      { header: "연계 요구사항", key: "linkedRequirements", width: 18 },
    ], clean(m.needs));

    // 6. 경쟁사·점유율
    const ws6 = sheet(wb, "6.경쟁사분석", `시장 점유율 및 경쟁사 분석${estimated}`, [18, 16, 14, 40, 40, 30]);
    sectionTitle(ws6, 3, "시장 점유율");
    r = writeTable(ws6, 4, [
      { header: "사업자", key: "company", width: 18 },
      { header: "점유율", key: "share", width: 16 },
      { header: "대표값(%)", key: "shareValue", width: 14 },
      { header: "근거", key: "basis", width: 40 },
      { header: "확인 자료", key: "sourceName", width: 40 },
      { header: "출처 검증", key: "verified", width: 30 },
    ], clean(m.shares).map((s, i) => ({ ...s, shareValue: m.shares[i].shareValue ?? "확인 필요", verified: m.shares[i].verified ? `검색 확인 ${m.shares[i].sourceUrl}` : "확인 필요" })), false);
    const shareStart = 5;
    const shareEnd = shareStart + m.shares.length - 1;
    if (m.shares.length) {
      ws6.addConditionalFormatting({
        ref: `C${shareStart}:C${shareEnd}`,
        rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 100 }], color: { argb: "FF5B8CC9" } } as ExcelJS.DataBarRuleType],
      });
    }
    sectionTitle(ws6, r, "경쟁사 특장점");
    writeTable(ws6, r + 1, [
      { header: "업체", key: "company", width: 18 },
      { header: "주력 솔루션", key: "offering", width: 16 },
      { header: "유사 레퍼런스", key: "references", width: 14 },
      { header: "특장점", key: "strengths", width: 40 },
      { header: "약점·한계", key: "weaknesses", width: 40 },
      { header: "제안사 대응 포인트", key: "ourResponse", width: 30 },
    ], clean(m.competitors), false);

    // 7. SWOT
    const ws7 = sheet(wb, "7.SWOT", `SWOT 분석 — ${m.swotSubject}`, [14, 60, 60]);
    const quad = (row: number, col: number, key: string, label: string, items: string[]) => {
      const h = ws7.getCell(row, col);
      h.value = label;
      h.font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SWOT_FILL[key] } };
      h.border = BORDER;
      const c = ws7.getCell(row + 1, col);
      c.value = cellText(bullets(items));
      c.font = { name: FONT, size: 10 };
      c.alignment = { vertical: "top", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SWOT_FILL[key] } };
      c.border = BORDER;
    };
    ws7.getCell(3, 2).value = "강점·기회 (Positive)";
    ws7.getCell(3, 3).value = "약점·위협 (Negative)";
    ws7.getCell(4, 1).value = "내부";
    ws7.getCell(6, 1).value = "외부";
    [ws7.getCell(3, 2), ws7.getCell(3, 3), ws7.getCell(4, 1), ws7.getCell(6, 1)].forEach((c) => (c.font = { name: FONT, bold: true, color: { argb: "FF5D6A78" } }));
    quad(4, 2, "S", "S · 강점", m.swot.strengths);
    quad(4, 3, "W", "W · 약점", m.swot.weaknesses);
    quad(6, 2, "O", "O · 기회", m.swot.opportunities);
    quad(6, 3, "T", "T · 위협", m.swot.threats);
    const maxLines = (xs: string[][]) => Math.max(...xs.map((x) => x.length), 1);
    ws7.getRow(5).height = maxLines([m.swot.strengths, m.swot.weaknesses]) * 32 + 10;
    ws7.getRow(7).height = maxLines([m.swot.opportunities, m.swot.threats]) * 32 + 10;
    sectionTitle(ws7, 9, "SWOT 교차 전략");
    writeTable(ws7, 10, [
      { header: "구분", key: "type", width: 14 },
      { header: "전략", key: "strategy", width: 60 },
      { header: "내용", key: "description", width: 60 },
    ], clean(m.tows), false);
  }

  const n = m ? 8 : 4;
  // 벤치마킹
  table(wb, `${n}.벤치마킹`, b?.searched ? "동종업계 벤치마킹" : "동종업계 벤치마킹 (웹 검색 미사용 — 출처 확인 필요)", [
    { header: "기관", key: "organization", width: 16 },
    { header: "사례", key: "caseName", width: 28 },
    { header: "연도", key: "year", width: 8 },
    { header: "사례 요약", key: "summary", width: 50 },
    { header: "본 사업 시사점", key: "implication", width: 45 },
    { header: "출처", key: "sourceName", width: 30 },
    { header: "링크", key: "sourceUrl", width: 40 },
    { header: "출처 검증", key: "verified", width: 10 },
  ], clean((b?.benchmarks ?? []).map((x) => ({ ...x, verified: x.verified ? "검색 확인" : "확인 필요" }))));

  // 갭 분석
  table(wb, `${n + 1}.갭분석`, "갭(Gap) 분석", [
    { header: "영역", key: "area", width: 16 },
    { header: "AS-IS", key: "asis", width: 35 },
    { header: "TO-BE", key: "tobe", width: 35 },
    { header: "참고 사례", key: "benchmark", width: 18 },
    { header: "Gap", key: "gap", width: 35 },
    { header: "개선과제", key: "task", width: 35 },
    { header: "우선순위", key: "priority", width: 9 },
  ], clean(b?.gaps));

  // 추진전략
  table(wb, `${n + 2}.추진전략`, "추진전략", [
    { header: "No", key: "no", width: 5 },
    { header: "추진전략", key: "strategy", width: 24 },
    { header: "세부 내용", key: "description", width: 60 },
    { header: "연계 요구사항", key: "linkedRequirements", width: 22 },
    { header: "차별화 포인트", key: "differentiation", width: 45 },
  ], clean(a.strategies).map((s, i) => ({ no: i + 1, ...s })));

  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
