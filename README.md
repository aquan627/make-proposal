# RFP Analyzer

제안요청서(RFP)를 넣으면 제안 기초자료를 엑셀(6개 시트)로 정리하는 웹앱입니다.

| 시트 | 내용 | 생성 방식 |
|---|---|---|
| 1.사업개요 | 배경·목적·목표·범위·기간·예산·기대효과 | RFP 분석 |
| 2.요구사항분석 | ID·분류·중요도·난이도·대응방안 | RFP 분석 |
| 3.AS-IS분석 | 현행 현황·문제점·확인 필요사항 | RFP 분석 (RFP 근거만) |
| 4.벤치마킹 | 동종업계 사례·시사점·출처 | AI 지식 (선택: Google 검색) |
| 5.갭분석 | AS-IS / TO-BE / Gap / 개선과제 | 벤치마킹 결과 기반 |
| 6.추진전략 | 전략·연계 요구사항·차별화 | RFP 분석 |

AI는 Google Gemini API를 사용합니다. 무료 키로 동작하며, 무료 등급에서는 Google 검색 연동이 제공되지 않아 벤치마킹은 AI가 알고 있는 사례 기반 초안으로 만들어지고 "확인 필요"로 표시됩니다. 유료 키에서 `GEMINI_SEARCH=on`을 설정하면 검색 결과 기반으로 작성하고 출처 링크를 붙입니다.

## 배포 (GitHub → Vercel)

1. GitHub에 새 저장소를 만들고 이 폴더를 push
   ```bash
   git remote add origin https://github.com/<계정>/rfp-analyzer.git
   git push -u origin main
   ```
2. vercel.com → Add New → Project → 해당 저장소 Import (프레임워크는 Next.js 자동 인식)
3. Environment Variables 추가 → Deploy
   - `GEMINI_API_KEY`: https://aistudio.google.com/apikey 에서 무료 발급
   - `APP_PASSWORD`: 팀에 공유할 접근 비밀번호 (8자 이상, 미설정 시 앱이 잠김)

선택 환경변수
- `GEMINI_MODEL`: 모델 변경 (기본 `gemini-3.8-flash`)
- `GEMINI_SEARCH=on`: Google 검색 기반 벤치마킹 (유료 키 필요)
- `NEXT_PUBLIC_GEMINI_PAID=on`: 유료 키 사용 시 (동의 문구가 바뀜)

## 보안

- 외부 AI 전송 전 개인정보(주민번호·전화·이메일·계좌·카드·IP·성명 등)를 자동 마스킹
- PDF는 서버에서 글자만 추출해 마스킹 후 전송, 원본은 외부로 보내지 않음
- 비밀번호 로그인, 호출 횟수 제한, CSRF 차단, 보안 헤더
- **Gemini 무료 등급은 입력을 Google이 개선·사람 검토에 사용할 수 있습니다. 실제 고객 RFP는 유료 등급 키로만 사용하세요.**
- 점검 기준과 이력: `SECURITY.md`

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # API 키 입력
npm run dev                   # http://localhost:3000
```

## 구조

```
app/page.tsx              화면 (입력 → 진행 단계 → 탭 미리보기 → 엑셀 다운로드)
app/api/analyze           1단계: RFP 분석 (구조화 출력)
app/api/benchmark         2단계: 벤치마킹 + 갭 분석
app/api/excel             엑셀 생성
lib/gemini.ts             LLM 호출 (다른 모델·사내 LLM 전환 시 이 파일만 교체)
lib/pii.ts                개인정보 마스킹, 링크 검증
lib/auth.ts, proxy.ts     로그인·세션
lib/guard.ts              요청 크기·출처·호출 횟수 제한
lib/excel.ts              엑셀 서식
lib/sample.ts             데모용 가상 RFP
```

## 제약사항

- Gemini 무료 등급은 분당·일일 호출 한도가 있어, 연속 실행 시 잠시 기다려야 할 수 있음
- PDF는 3MB 이하 (Vercel 요청 크기 제한 4.5MB). 큰 RFP는 요구사항 부분 텍스트를 붙여넣기
- 분석 1~2분, 벤치마킹 1~2분 소요. 각 API는 최대 300초로 설정
- AI가 생성한 초안이므로 제안서 반영 전 검토 필요. 대외비 RFP는 사내 보안 정책 확인 후 사용
