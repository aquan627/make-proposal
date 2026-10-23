#!/usr/bin/env node
// SECURITY.md 기준 정적 점검. 문제가 있으면 종료 코드 1.
// 사용: npm run security:scan
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];
const fail = (id, msg) => problems.push(`[${id}] ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const files = ["app", "lib"].flatMap((d) => walk(path.join(root, d))).concat(["proxy.ts"].map((f) => path.join(root, f)));
const rel = (p) => path.relative(root, p);

for (const f of files) {
  const src = readFileSync(f, "utf8");
  // O-2 HTML 삽입 금지
  if (src.includes("dangerouslySetInnerHTML")) fail("O-2", `${rel(f)}: dangerouslySetInnerHTML 사용`);
  // P-5 본문·응답 로그 금지 (console.error("[api] failed", 상태) 만 허용)
  for (const m of src.matchAll(/console\.(log|info|debug|warn|error)\(([^)]*)\)/g)) {
    if (!(m[1] === "error" && m[2].trim().startsWith('"[api] failed"'))) fail("P-5", `${rel(f)}: ${m[0].slice(0, 60)}`);
  }
  // S-2 비밀값에 NEXT_PUBLIC_ 금지
  for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|PASSWORD|TOKEN)[A-Z0-9_]*/g)) fail("S-2", `${rel(f)}: ${m[0]}`);
}

// A-1~A-6, P-1~P-3 API 경로 규칙
const apiDir = path.join(root, "app", "api");
for (const name of readdirSync(apiDir)) {
  const f = path.join(apiDir, name, "route.ts");
  const src = readFileSync(f, "utf8");
  if (name === "logout") continue;
  if (!src.includes("readJson")) fail("A-5/A-6", `app/api/${name}: readJson(출처·크기 검사) 미사용`);
  if (src.includes("@/lib/llm")) {
    if (!src.includes("rateLimit")) fail("A-4", `app/api/${name}: AI 호출 경로에 rateLimit 없음`);
    if (!/maskPII|maskDeep/.test(src)) fail("P-1/P-2", `app/api/${name}: AI 호출 전 마스킹 없음`);
    if (!src.includes("streamJson")) fail("NFR-003", `app/api/${name}: 긴 AI 요청에 스트리밍(연결 유지) 미사용`);
  }
}
const proxySrc = readFileSync(path.join(root, "proxy.ts"), "utf8");
if (!/matcher:\s*\[\s*"\/\(\(\?!api\/login\|/.test(proxySrc)) fail("A-1", "proxy.ts matcher가 api/login 외 경로를 모두 보호하지 않음");

// P-3 원본 PDF를 외부로 보내는 코드 금지
const gem = readFileSync(path.join(root, "lib", "llm.ts"), "utf8");
if (/application\/pdf|inlineData|input_file|input_image/.test(gem)) fail("P-3", "lib/llm.ts: 원본 파일(PDF·input_file 등)을 AI로 전송");

// S-1 비밀정보: 추적 중인 .env 파일, 커밋 이력의 실제 키
try {
  const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n");
  for (const t of tracked) if (/(^|\/)\.env(\.|$)/.test(t) && !t.endsWith(".env.example")) fail("S-1", `추적 중인 비밀 파일: ${t}`);
  const hist = execSync("git log -p --all", { encoding: "utf8", maxBuffer: 1 << 28 });
  for (const re of [/AIza[0-9A-Za-z_-]{35}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /ghp_[A-Za-z0-9]{36}/]) {
    if (re.test(hist)) fail("S-1", `커밋 이력에 실제 키 형식 발견: ${re}`);
  }
} catch (e) {
  fail("S-1", "git 이력을 읽지 못했습니다: " + (e instanceof Error ? e.message.slice(0, 80) : ""));
}

if (problems.length) {
  console.error(`보안 스캔 실패 (${problems.length}건)\n` + problems.map((p) => " - " + p).join("\n"));
  process.exit(1);
}
console.log(`보안 스캔 통과: 파일 ${files.length}개, API 경로 ${readdirSync(apiDir).length}개 점검`);
