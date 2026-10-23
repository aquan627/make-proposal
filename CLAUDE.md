# RFP Analyzer — 작업 규칙

금융권 SI 제안용 RFP 분석 앱 (Next.js 16 + OpenAI API + ExcelJS, Vercel 배포).
요구사항 원본: `docs/REQUIREMENTS.md` · 보안 기준: `SECURITY.md`
대외비 RFP와 개인정보를 다룰 수 있으므로 **모든 변경은 `SECURITY.md` 기준을 지켜야 합니다.**

## 변경 시 반드시 지킬 것

- 외부 AI로 가는 모든 텍스트는 `lib/pii.ts`의 `maskPII`/`maskDeep`을 거친다. 새 API 경로를 만들 때도 동일.
- 원본 파일(PDF 등)을 외부 AI로 직접 보내지 않는다. 서버에서 텍스트 추출 → 마스킹 → 전송.
- RFP 본문·AI 응답·비밀번호를 `console.log`, 파일, DB에 남기지 않는다. 로그는 `lib/guard.ts`의 `errorResponse`만 사용.
- 새 API 경로는 `readJson`(크기 제한·CSRF)과 `rateLimit`을 쓰고, `proxy.ts`의 로그인 보호 범위 안에 둔다.
- AI가 만든 URL은 `safeUrl`로 검증한 뒤에만 링크로 렌더링한다. `dangerouslySetInnerHTML` 금지.
- 비밀 값은 서버 환경변수로만. `NEXT_PUBLIC_` 접두어를 붙이지 않는다.
- 샘플·테스트 데이터는 가상 기관·가상 값만 쓴다.

## 하네스 (에이전트·스킬·테스트)

| 구분 | 이름 | 언제 쓰나 |
|---|---|---|
| 에이전트 | `security-reviewer` | 코드 변경 후, PR 전, 정기 점검 — SECURITY.md 기준 검토(수정은 안 함) |
| 에이전트 | `qa-tester` | 기능 추가·버그 수정 후 — 가짜 LLM로 테스트 작성·실행, 요구사항 ID 연결 |
| 에이전트 | `deploy-checker` | push 후, 오류 보고 시 — Vercel 배포·환경변수·로그 확인 |
| 에이전트 | `spec-keeper` | 기능 변경 후, 산출물 제출 전 — docs/REQUIREMENTS.md·추적표 갱신 |
| 스킬 | `add-analysis-feature` | 새 분석 항목·엑셀 시트 추가 (7개 위치 일괄 변경) |
| 스킬 | `release-check` | push 전 점검 → 배포 확인 |
| 스킬 | `deploy-troubleshoot` | 화면 오류 문구별 원인·조치 |
| 스킬 | `security-audit` | 주간 보안 점검 → security/날짜 브랜치 PR |
| 스킬 | `srs-docx` | 회사 템플릿으로 요구사항명세서(.docx) 작성 |

### 표준 작업 흐름

1. 요구사항 정의: `docs/REQUIREMENTS.md`에 ID와 수용 기준 추가 (spec-keeper)
2. 구현: 새 분석이면 `add-analysis-feature` 스킬
3. 테스트: qa-tester — 테스트 이름에 요구사항 ID, 외부 API 호출 금지
4. 보안 검토: security-reviewer
5. 릴리스: `release-check` 스킬 (CI 통과 + Vercel READY + 사용자 1회 실행 확인)

### 점검 명령

| 명령 | 내용 |
|---|---|
| `npm test` | vitest 테스트 (가짜 LLM, 외부 호출 없음) |
| `npm run security:scan` | SECURITY.md 기준 정적 점검 (마스킹 누락, 로그, 비밀값, 키 유출 이력) |
| `npm run trace` | 요구사항 ↔ 테스트 추적표 (`-- --strict`: 보안 요구사항 테스트 누락 시 실패) |
| `npm run check` | 타입검사 + 테스트 + 보안 스캔 + 의존성 감사 + 빌드 (push 전 필수, CI와 동일) |

## 정기 보안 점검

`security-audit` 스킬 절차를 따른다. 결과는 `SECURITY.md` 점검 이력에 한 줄 추가하고
`security/YYYY-MM-DD` 브랜치 PR로 올린다. `main`에 직접 push하지 않는다.

## 설치 참고

npm peer 의존성 해석 오류 때문에 `.npmrc`에 `legacy-peer-deps=true`를 둔다. vitest가 쓰는 `vite`는 devDependency로 명시돼 있다.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | O | platform.openai.com에서 발급 (Billing 크레딧 필요) |
| `APP_PASSWORD` | O | 접근 비밀번호, 8자 이상. 미설정 시 앱 잠김 |
| `OPENAI_MODEL` | | 기본 `gpt-6.1-sol` |
| `OPENAI_SEARCH` | | `on`이면 웹 검색 기반 벤치마킹·시장 분석 |
| `OPENAI_REASONING_EFFORT` | | 추론 수준, 기본 `low` |
