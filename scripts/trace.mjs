#!/usr/bin/env node
// 요구사항 ↔ 테스트 추적표. docs/REQUIREMENTS.md의 ID가 tests/*.test.ts 어디에 나오는지 보여준다.
// 사용: npm run trace            (표 출력)
//       npm run trace -- --strict (테스트 없는 보안 요구사항(SER)이 있으면 실패)
import { readdirSync, readFileSync } from "node:fs";

const spec = readFileSync("docs/REQUIREMENTS.md", "utf8");
const seen = new Set();
const rows = [...spec.matchAll(/^\| ((?:SFR|SER|NFR|IFR|DAR)-\d{3}) \| ([^|]+)\|/gm)].map((m) => ({ id: m[1], name: m[2].trim() })).filter((r) => !seen.has(r.id) && seen.add(r.id));
const tests = readdirSync("tests").filter((f) => f.endsWith(".test.ts")).map((f) => ({ f, src: readFileSync(`tests/${f}`, "utf8") }));

const expand = (src) => {
  const ids = new Set(src.match(/(?:SFR|SER|NFR|IFR|DAR)-\d{3}/g) ?? []);
  for (const m of src.matchAll(/((?:SFR|SER|NFR|IFR|DAR)-)(\d{3})~(\d{3})/g)) for (let i = +m[2]; i <= +m[3]; i++) ids.add(m[1] + String(i).padStart(3, "0"));
  for (const m of src.matchAll(/((?:SFR|SER|NFR|IFR|DAR)-)(\d{3})\/(\d{3})/g)) ids.add(m[1] + m[3]);
  return ids;
};
const covered = new Map(tests.map((t) => [t.f, expand(t.src)]));

let missingSer = 0;
console.log("| ID | 요구사항 | 테스트 파일 |\n| --- | --- | --- |");
for (const r of rows) {
  const where = [...covered].filter(([, ids]) => ids.has(r.id)).map(([f]) => f);
  if (!where.length && r.id.startsWith("SER")) missingSer++;
  console.log(`| ${r.id} | ${r.name} | ${where.join(", ") || "-"} |`);
}
const done = rows.filter((r) => [...covered.values()].some((ids) => ids.has(r.id))).length;
console.log(`\n테스트 연결: ${done}/${rows.length}건, 테스트 없는 보안 요구사항: ${missingSer}건`);
if (process.argv.includes("--strict") && missingSer) process.exit(1);
