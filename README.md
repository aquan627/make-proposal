# RFP Analyzer

제안요청서(RFP)를 넣으면 제안 기초자료를 엑셀(6개 시트)로 정리하는 웹앱입니다.

| 시트 | 내용 | 생성 방식 |
|---|---|---|
| 1.사업개요 | 배경·목적·목표·범위·기간·예산·기대효과 | RFP 분석 |
| 2.요구사항분석 | ID·분류·중요도·난이도·대응방안 | RFP 분석 |
| 3.AS-IS분석 | 현행 현황·문제점·확인 필요사항 | RFP 분석 (RFP 근거만) |
| 4.벤치마킹 | 동종업계 사례·시사점·출처 | 웹 검색 |
| 5.갭분석 | AS-IS / TO-BE / Gap / 개선과제 | 웹 검색 결과 기반 |
| 6.추진전략 | 전략·연계 요구사항·차별화 | RFP 분석 |

벤치마킹 출처 URL은 실제 검색 결과와 대조해, 검색에서 확인되지 않은 링크는 "확인 필요"로 표시합니다.

## 배포 (GitHub → Vercel)

1. GitHub에 새 저장소를 만들고 이 폴더를 push
   ```bash
   git remote add origin https://github.com/<계정>/rfp-analyzer.git
   git push -u origin main
   ```
2. vercel.com → Add New → Project → 해당 저장소 Import (프레임워크는 Next.js 자동 인식)
3. Environment Variables에 `ANTHROPIC_API_KEY` 추가 → Deploy

선택: `ANTHROPIC_MODEL`로 모델 변경 (기본 `claude-sonnet-5-5`)

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
app/api/benchmark         2단계: 웹 검색 벤치마킹 + 갭 분석
app/api/excel             엑셀 생성
lib/claude.ts             LLM 호출 (사내 LLM 전환 시 이 파일만 교체)
lib/excel.ts              엑셀 서식
lib/sample.ts             데모용 가상 RFP
```

## 제약사항

- PDF는 3MB 이하 (Vercel 요청 크기 제한 4.5MB). 큰 RFP는 요구사항 부분 텍스트를 붙여넣기
- 분석 1~2분, 벤치마킹 1~2분 소요. 각 API는 최대 300초로 설정
- AI가 생성한 초안이므로 제안서 반영 전 검토 필요. 대외비 RFP는 사내 보안 정책 확인 후 사용
