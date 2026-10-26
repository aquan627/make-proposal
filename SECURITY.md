# 보안 점검 기준 (RFP Analyzer)

이 앱은 대외비일 수 있는 제안요청서(RFP)를 외부 AI(Google Gemini API)로 보내 분석합니다.
아래 항목을 변경 시마다, 그리고 정기 점검 때마다 확인합니다. 결과는 맨 아래 점검 이력에 남깁니다.

## 1. 개인정보·민감정보

| ID | 점검 항목 | 기준 | 구현 위치 |
|---|---|---|---|
| P-1 | 외부 AI 전송 전 개인정보 마스킹 | 주민·외국인등록번호, 여권, 운전면허, 카드(Luhn), 전화, 이메일, 사업자번호, 계좌, IP, 직함·라벨 붙은 성명을 마스킹 | `lib/pii.ts` |
| P-2 | 이중 마스킹 | 브라우저에서 1차, 서버(`/api/analyze`, `/api/benchmark`)에서 2차 적용 | `app/page.tsx`, `app/api/*` |
| P-3 | 원본 PDF 외부 전송 금지 | PDF는 서버에서 텍스트만 추출(`unpdf`) → 마스킹 → 전송. 원본은 저장·전송하지 않음 | `lib/pdf.ts` |
| P-4 | 사용자 고지·동의 | Gemini API 전송과 데이터 정책(무료 등급은 Google 개선·사람 검토에 사용 가능, 유료 등급은 학습 미사용)을 고지하고 동의 체크 없이는 분석 불가 | `app/page.tsx`, `/api/analyze` |
| P-5 | 서버 저장·로그 금지 | RFP 본문, AI 응답, 비밀번호를 DB·파일·로그에 남기지 않음. 오류 로그는 상태 코드만 | `lib/guard.ts` |
| P-6 | 마스킹 토큰 복원 금지 | 프롬프트에 "[OO 마스킹] 값을 추측·복원하지 말 것" 명시 | `lib/llm.ts` |
| P-7 | 샘플 데이터 | 저장소의 샘플 RFP·예시는 가상 기관·가상 수치만 사용 | `lib/sample.ts` |

## 2. 접근 제어·API 보호

| ID | 점검 항목 | 기준 | 구현 위치 |
|---|---|---|---|
| A-1 | 로그인 필수 | `APP_PASSWORD`(8자 이상) 미설정 시 앱 전체 잠금. 화면·API 모두 세션 필요 | `proxy.ts`, `lib/auth.ts` |
| A-2 | 세션 쿠키 | HMAC 서명, HttpOnly, Secure, SameSite=Strict, 12시간 만료. 비밀번호 원문은 쿠키에 없음 | `lib/auth.ts` |
| A-3 | 로그인 무차별 대입 방지 | IP당 10분 10회 | `app/api/login` |
| A-4 | AI 호출 남용 방지 | IP당 10분 20회 (분석 1회 = 호출 2회, 인스턴스 메모리 기반 1차 방어) | `lib/guard.ts` |
| A-5 | CSRF | JSON content-type 강제 + Origin/Host 일치 확인 + SameSite=Strict | `lib/guard.ts` |
| A-6 | 입력 크기 제한 | 텍스트 15만 자, PDF 3MB(매직바이트 `%PDF-` 확인), 2단계 300KB, 엑셀 1MB | `app/api/*` |

## 3. 출력·화면

| ID | 점검 항목 | 기준 | 구현 위치 |
|---|---|---|---|
| O-1 | 링크 XSS | AI가 만든 URL은 http/https만 허용(`safeUrl`), `rel="noopener noreferrer"` | `lib/pii.ts`, `app/page.tsx` |
| O-2 | HTML 삽입 금지 | `dangerouslySetInnerHTML` 사용 금지 (React 기본 이스케이프 유지) | 전체 |
| O-3 | 엑셀 수식 주입 | `=`, `+`, `@`로 시작하는 값은 문자로 고정 | `lib/excel.ts` |
| O-4 | 오류 메시지 | 외부 API 원문·스택을 화면에 노출하지 않음 | `lib/llm.ts`, `lib/guard.ts` |
| O-6 | AI 추정 수치 표시 | 검색 미사용 시 벤치마킹 사례를 "출처 확인 필요"로 화면·엑셀에 표시. 사실처럼 단정하지 않음 | `lib/llm.ts`, `app/page.tsx`, `lib/excel.ts` |
| O-5 | 프롬프트 주입 | RFP 본문 속 지시문을 따르지 않도록 시스템 지시 명시. AI 도구는 googleSearch만 허용 | `lib/llm.ts` |

## 4. 설정·비밀정보·의존성

| ID | 점검 항목 | 기준 |
|---|---|---|
| S-1 | 비밀정보 커밋 금지 | `.env*`는 gitignore. 커밋 이력에 `AIza`, `sk-ant` 등 실제 키 없음 (`git log -p` 검색) |
| S-2 | 키는 서버 전용 | `GEMINI_API_KEY`, `APP_PASSWORD`에 `NEXT_PUBLIC_` 접두어 금지 |
| S-3 | 보안 헤더 | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS, API no-store (`next.config.ts`) |
| S-4 | 의존성 취약점 | `npm audit --omit=dev` 결과 high/critical 0건. moderate는 사유 기록 |
| S-5 | 저장소 공개 범위 | GitHub 저장소는 private 권장. public이면 비밀정보·실데이터 없음을 확인 |
| S-6 | 배포 정리 | 사용하지 않는 Vercel 프로젝트·프리뷰 배포 제거, 환경변수는 필요한 프로젝트에만 |
| S-7 | AI 데이터 정책 | Gemini API 약관·데이터 정책(무료 등급 학습·사람 검토 사용, 유료 등급 학습 미사용)을 정기 점검 때 확인. 대외비 RFP는 유료 키와 회사 정책에 따라 사용 |

## 5. 알려진 한계

- 마스킹은 정규식 기반이라 형식이 없는 이름·주소·고객사 내부 명칭은 놓칠 수 있습니다. 동의 문구로 사용자 확인을 요구합니다.
- 버전 번호처럼 IP 형식인 값(예: 1.2.3.4)도 가려질 수 있습니다(보수적 처리).
- 호출 횟수 제한은 서버리스 인스턴스별 메모리 방식이라 분산 공격을 완전히 막지 못합니다. 필요 시 Vercel Firewall 규칙이나 Upstash 등 외부 저장소 기반으로 교체합니다.

## 점검 이력

| 날짜 | 점검자 | 결과 | 조치 |
|---|---|---|---|
| 2026-10-26 | Claude (LLM 전환 점검) | OpenAI → Gemini 재전환 | 마스킹·가드·스트리밍·병렬 호출 유지, SDK 기본 재시도(5회) 끄고 250초 제한, 동의 문구·P-4·S-7을 Gemini 정책으로 갱신 |
| 2026-10-23 | Claude (기능 제거 점검) | 시장 분석 기능 제거 | `/api/market`·제안사 정보 입력 삭제로 외부 전송 경로 축소, 크기 제한·호출 수 기준 갱신 |
| 2026-10-23 | Claude (LLM 전환 점검) | Gemini → OpenAI 전환 | 마스킹·가드·스트리밍 유지 확인, 동의 문구와 P-4·S-7을 OpenAI 데이터 정책으로 갱신, 정적 스캔에 input_file/input_image 전송 금지 추가 |
| 2026-10-23 | Claude (하네스 구축) | 테스트 64개·보안 스캔·CI 추가 | 정적 규칙(P-1~3, P-5, A-1, A-4~6, S-1~2, NFR-003)을 security-scan으로 자동화, 보안 요구사항 전부 테스트 연결 |
| 2026-10-23 | Claude (기능 추가 점검) | 시장 분석 API 추가 | `/api/market`에 로그인·크기 제한·호출 제한·마스킹·스트리밍 적용, AI 추정 표시(O-6) 추가 |
| 2026-10-23 | Claude (초기 점검) | 위험 9건 발견 | 전 항목 보완: 마스킹, 원본 PDF 전송 중단, 로그인, 호출 제한, CSRF, 입력 제한, 링크 검증, 보안 헤더, 의존성(uuid) 패치 |
