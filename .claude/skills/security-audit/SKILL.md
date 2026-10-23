---
name: security-audit
description: RFP Analyzer 정기(주간) 보안 점검 절차. 예약 작업이나 "보안 점검해줘" 요청 때 사용한다. SECURITY.md 전 항목 확인, 자동 점검, Gemini 약관 변경 확인, 결과 PR 작성까지.
---

# 정기 보안 점검

## 1. 준비

- 저장소 최신화 후 `npm ci`.
- `SECURITY.md`, `CLAUDE.md`를 읽는다.

## 2. 자동 점검

```bash
npm run check                 # 타입검사·테스트·보안스캔·의존성감사·빌드
npm run trace -- --strict     # 보안 요구사항 테스트 누락 0건
```

## 3. 수동 점검 (security-reviewer 에이전트)

지난 점검 이후 커밋(`git log --since="7 days ago"`)을 대상으로 SECURITY.md P·A·O·S 항목을 확인한다.

## 4. 외부 변화 확인

- Gemini API 이용약관(ai.google.dev/gemini-api/terms)의 무료·유료 등급 데이터 사용 조항이 바뀌었는지 확인한다. 바뀌면 화면 동의 문구(`app/page.tsx`)와 SECURITY.md S-7을 갱신 대상으로 기록한다.
- `npm audit` moderate 이하 항목은 사유와 함께 기록한다.

## 5. 결과 반영

- 브랜치 `security/YYYY-MM-DD`를 만든다.
- SECURITY.md 점검 이력 표에 한 줄 추가: 날짜 | Claude (정기 점검) | 결과 | 조치.
- 문제가 있으면 같은 브랜치에서 수정하고 회귀 테스트를 추가한다.
- PR을 만든다. high 이상이면 제목 앞에 `[긴급]`. `main` 직접 push 금지.
- 요약: 점검 항목 수, 심각도별 발견, 조치, PR 링크, 사람이 해야 할 일.
