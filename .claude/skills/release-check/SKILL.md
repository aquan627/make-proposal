---
name: release-check
description: RFP Analyzer 변경을 GitHub에 올리고 Vercel 배포까지 확인할 때 사용하는 릴리스 점검 절차. push 전 점검, 배포 확인, 사용자 확인 요청까지 포함한다.
---

# 릴리스 점검

## push 전

1. `npm run check` — 타입검사, 테스트, 보안 스캔, 의존성 감사(high 이상 차단), 빌드가 모두 통과해야 한다.
2. `npm run trace -- --strict` — 테스트 없는 보안 요구사항이 0건이어야 한다.
3. `git status`로 `.env*`, `.next`, 개인 파일이 섞이지 않았는지 본다.
4. 보안 관련 변경이면 security-reviewer 에이전트 결과를 확인한다.

## push

- 일반 변경: `main`에 push하면 Vercel이 자동 배포한다.
- 정기 보안 점검 결과: `security/YYYY-MM-DD` 브랜치로 올리고 PR을 만든다. `main` 직접 push 금지.
- 커밋 메시지는 한국어로 무엇이 왜 바뀌었는지 쓴다.

## push 후

1. GitHub Actions `CI`가 통과했는지 확인한다.
2. Vercel 최신 배포가 READY이고 커밋이 일치하는지 확인한다 (deploy-checker 에이전트).
3. 환경변수를 새로 추가했다면 **Production 체크**와 재배포를 확인한다.
4. 사용자에게 새로고침 후 샘플 RFP로 1회 실행해 달라고 요청한다. 실제 OpenAI 호출은 자동 테스트가 대신하지 못한다.
