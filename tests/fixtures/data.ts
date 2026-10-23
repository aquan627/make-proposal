// 테스트용 가상 데이터 (실제 기관·인물과 무관)
import type { Analysis, BenchmarkResult } from "@/lib/types";

export const SAMPLE_TEXT = `[제안요청서] 한빛은행(가상) 지급결제 플랫폼 구축
담당자: 홍길동 (디지털금융본부 김철수 과장, 010-1234-5678, pm@hanbit.example.com)
내부 서버 10.20.30.40, 정산 계좌 110-123-456789
SFR-001 이체 처리: 이체 한도를 고객 등급별로 관리 (2026-10-23 착수, 예산 85억원)`;

export const analysis: Analysis = {
  overview: {
    projectName: "차세대 지급결제 플랫폼 구축",
    client: "한빛은행(가상)",
    background: "메인프레임 노후화",
    purpose: "유연한 지급결제 플랫폼 구축",
    goals: ["리드타임 단축", "3,000 TPS"],
    scope: ["코어 재구축"],
    period: "14개월",
    budget: "85억원",
    expectedEffects: [{ type: "정량", effect: "수작업 40% → 10%" }],
  },
  requirements: [{ id: "SFR-001", category: "기능", name: "이체 처리", description: "=SUM(A1) 수식처럼 보이는 값", priority: "상", difficulty: "중", response: "한도 엔진" }],
  asis: [{ area: "정산", current: "수작업 40%", issue: "오류", toConfirm: "담당자: 홍길동 연락 010-9999-8888" }],
  strategies: [{ strategy: "단계적 전환", description: "업무 단위 전환", linkedRequirements: "SFR-001", differentiation: "레퍼런스" }],
  benchmarkTopics: ["은행 차세대"],
};

export const bench: BenchmarkResult = {
  benchmarks: [{ organization: "국내 시중은행", caseName: "단계적 전환", year: "확인 필요", summary: "요약", implication: "시사점", sourceUrl: "javascript:alert(1)", sourceName: "", verified: false }],
  gaps: [{ area: "정산", asis: "수작업", tobe: "자동", benchmark: "시중은행", gap: "자동화", task: "대사 엔진", priority: "상" }],
  searched: false,
};
