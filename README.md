# RFP Analyzer

제안요청서(RFP)를 넣으면 제안 기초자료를 엑셀(6개 시트)로 정리하는 웹앱입니다.

| 시트 | 내용 | 생성 방식 |
|---|---|---|
| 1.사업개요 | 배경·목적·목표·범위·기간·예산·기대효과 | RFP 분석 |
| 2.요구사항분석 | ID·분류·중요도·난이도·대응방안 | RFP 분석 |
| 3.AS-IS분석 | 현행 현황·문제점·확인 필요사항 | RFP 분석 (RFP 근거만) |
| 4.시장트렌드 | 시장 정의·규모·성장성, 주요 트렌드와 시사점 | AI 지식 (선택: 웹 검색) |
| 5.고객니즈 | 대고객(최종 이용자) 니즈·불편·제안 반영 방안 | AI 분석 |
| 6.경쟁사분석 | 시장 점유율(막대), 경쟁사 특장점·약점·대응 포인트 | AI 지식 (선택: 웹 검색) |
| 7.SWOT | SWOT 2×2, SO/ST/WO/WT 교차 전략 | 시장·경쟁 분석 + 입력한 제안사 정보 |
| 8.벤치마킹 | 동종업계 사례·시사점·출처 | AI 지식 (선택: 웹 검색) |
| 9.갭분석 | AS-IS / TO-BE / Gap / 개선과제 | 벤치마킹 결과 기반 |
| 10.추진전략 | 전략·연계 요구사항·차별화 | RFP 분석 |

AI는 OpenAI API(Responses API, 구조화 출력)를 사용합니다. API 키에 결제 크레딧이 있어야 동작합니다. 기본은 웹 검색 없이 작성하며, 벤치마킹·시장 수치는 AI 추정 초안으로 "확인 필요"가 표시됩니다. `OPENAI_SEARCH=on`을 설정하면 웹 검색 결과를 근거로 작성하고 출처 링크를 붙입니다(검색 호출 비용 추가).

## 배포 (GitHub → Vercel)

1. GitHub에 새 저장소를 만들고 이 폴더를 push
   ```bash
   git remote add origin https://github.com/<계정>/rfp-analyzer.git
   git push -u origin main
   ```
2. vercel.com → Add New → Project → 해당 저장소 Import (프레임워크는 Next.js 자동 인식)
3. Environment Variables 추가 → Deploy
   - `OPENAI_API_KEY`: https://platform.openai.com/api-keys 에서 발급 (Billing 크레딧 필요)
   - `APP_PASSWORD`: 팀에 공유할 접근 비밀번호 (8자 이상, 미설정 시 앱이 잠김)

선택 환경변수
- `OPENAI_MODEL`: 모델 변경 (기본 `gpt-6.1-sol`)
- `OPENAI_REASONING_EFFORT`: 추론 수준 (기본 `low`)
- `OPENAI_SEARCH=on`: 웹 검색 기반 벤치마킹·시장 분석

## 보안

- 외부 AI 전송 전 개인정보(주민번호·전화·이메일·계좌·카드·IP·성명 등)를 자동 마스킹
- PDF는 서버에서 글자만 추출해 마스킹 후 전송, 원본은 외부로 보내지 않음
- 비밀번호 로그인, 호출 횟수 제한, CSRF 차단, 보안 헤더
- **OpenAI는 API 입력을 학습에 쓰지 않지만 오남용 점검용으로 최대 30일 보관합니다. 대외비 RFP는 회사 보안 정책을 확인한 뒤 사용하세요.**
- 점검 기준과 이력: `SECURITY.md`

## 개발 하네스

- 테스트: `npm test` (vitest 64개, 가짜 LLM로 외부 호출 없음)
- 통합 점검: `npm run check` (타입검사·테스트·보안 스캔·의존성 감사·빌드), GitHub Actions CI에서 자동 실행
- 요구사항 추적: `npm run trace` (docs/REQUIREMENTS.md ↔ 테스트)
- Claude Code 에이전트·스킬: `.claude/agents`, `.claude/skills` (사용법은 `CLAUDE.md`)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # API 키 입력
npm run dev                   # http://localhost:3000
```

## 구조

```
docs/REQUIREMENTS.md      요구사항 (ID·수용 기준·추적표)
tests/                    vitest 테스트, fixtures
scripts/                  보안 스캔, 요구사항 추적
.claude/                  에이전트·스킬
app/page.tsx              화면 (입력 → 진행 단계 → 탭 미리보기 → 엑셀 다운로드)
app/api/analyze           1단계: RFP 분석 (구조화 출력)
app/api/benchmark         2단계: 벤치마킹 + 갭 분석
app/api/market            3단계: 시장 트렌드·점유율·경쟁사·SWOT·고객 니즈 (2단계와 동시 실행)
app/api/excel             엑셀 생성
lib/llm.ts                LLM 호출 (다른 모델·사내 LLM 전환 시 이 파일만 교체)
lib/pii.ts                개인정보 마스킹, 링크 검증
lib/auth.ts, proxy.ts     로그인·세션
lib/guard.ts              요청 크기·출처·호출 횟수 제한
lib/excel.ts              엑셀 서식
lib/sample.ts             데모용 가상 RFP
```

## 제약사항

- OpenAI 계정 등급별 호출 한도가 있어, 연속 실행 시 잠시 기다려야 할 수 있음
- PDF는 3MB 이하 (Vercel 요청 크기 제한 4.5MB). 큰 RFP는 요구사항 부분 텍스트를 붙여넣기
- 시장 규모·점유율은 검색 미사용 시 AI 추정치이므로 공시·보도자료로 확인 필요
- 분석 1~2분, 벤치마킹·시장 분석 동시 1~2분 소요. 각 API는 최대 300초로 설정
- AI가 생성한 초안이므로 제안서 반영 전 검토 필요. 대외비 RFP는 사내 보안 정책 확인 후 사용
