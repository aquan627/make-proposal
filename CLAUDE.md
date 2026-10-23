# RFP Analyzer — 작업 규칙

금융권 SI 제안용 RFP 분석 앱 (Next.js 16 + Google Gemini API + ExcelJS, Vercel 배포).
대외비 RFP와 개인정보를 다룰 수 있으므로 **모든 변경은 `SECURITY.md` 기준을 지켜야 합니다.**

## 변경 시 반드시 지킬 것

- 외부 AI로 가는 모든 텍스트는 `lib/pii.ts`의 `maskPII`/`maskDeep`을 거친다. 새 API 경로를 만들 때도 동일.
- 원본 파일(PDF 등)을 외부 AI로 직접 보내지 않는다. 서버에서 텍스트 추출 → 마스킹 → 전송.
- RFP 본문·AI 응답·비밀번호를 `console.log`, 파일, DB에 남기지 않는다. 로그는 `lib/guard.ts`의 `errorResponse`만 사용.
- 새 API 경로는 `readJson`(크기 제한·CSRF)과 `rateLimit`을 쓰고, `proxy.ts`의 로그인 보호 범위 안에 둔다.
- AI가 만든 URL은 `safeUrl`로 검증한 뒤에만 링크로 렌더링한다. `dangerouslySetInnerHTML` 금지.
- 비밀 값은 서버 환경변수로만. `NEXT_PUBLIC_` 접두어를 붙이지 않는다.
- 샘플·테스트 데이터는 가상 기관·가상 값만 쓴다.

## 정기 보안 점검

정기 점검 작업은 `SECURITY.md`의 모든 항목을 코드 기준으로 확인하고,
`npm audit --omit=dev`, 커밋 이력 비밀정보 검색, `npm run build`를 실행한 뒤,
결과를 `SECURITY.md`의 점검 이력 표에 한 줄 추가한다.
문제가 있으면 수정 브랜치(`security/YYYY-MM-DD`)에서 고치고 PR로 올린다. `main`에 직접 push하지 않는다.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | O | Google AI Studio에서 발급 |
| `APP_PASSWORD` | O | 접근 비밀번호, 8자 이상. 미설정 시 앱 잠김 |
| `GEMINI_MODEL` | | 기본 `gemini-3.8-flash` |
| `GEMINI_SEARCH` | | `on`이면 Google 검색 기반 벤치마킹 (유료 키 필요) |
| `NEXT_PUBLIC_GEMINI_PAID` | | 유료 키 사용 시 `on` (동의 문구 변경) |
