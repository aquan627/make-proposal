export type Overview = {
  projectName: string;
  client: string;
  background: string;
  purpose: string;
  goals: string[];
  scope: string[];
  period: string;
  budget: string;
  expectedEffects: { type: string; effect: string }[];
};

export type Requirement = {
  id: string;
  category: string;
  name: string;
  description: string;
  priority: string;
  difficulty: string;
  response: string;
};

export type AsIs = {
  area: string;
  current: string;
  issue: string;
  toConfirm: string;
};

export type Strategy = {
  strategy: string;
  description: string;
  linkedRequirements: string;
  differentiation: string;
};

export type Analysis = {
  overview: Overview;
  requirements: Requirement[];
  asis: AsIs[];
  strategies: Strategy[];
  benchmarkTopics: string[];
};

export type Benchmark = {
  organization: string;
  caseName: string;
  year: string;
  summary: string;
  implication: string;
  sourceUrl: string;
  sourceName: string;
  verified: boolean;
};

export type Gap = {
  area: string;
  asis: string;
  tobe: string;
  benchmark: string;
  gap: string;
  task: string;
  priority: string;
};

export type BenchmarkResult = {
  benchmarks: Benchmark[];
  gaps: Gap[];
  searched: boolean;
};

export type MarketShare = {
  company: string;
  share: string; // 표시용 (예: "약 30%", "확인 필요")
  shareValue: number | null; // 막대 표시용 0~100, 모르면 null
  basis: string; // 근거 설명
  sourceName: string;
  sourceUrl: string;
  verified: boolean; // 검색 출처와 대조됨
};

export type Competitor = {
  company: string;
  offering: string;
  strengths: string;
  weaknesses: string;
  references: string;
  ourResponse: string;
};

export type MarketTrend = { trend: string; description: string; impact: string; implication: string };

export type CustomerNeed = {
  segment: string;
  need: string;
  painPoint: string;
  priority: string;
  response: string;
  linkedRequirements: string;
};

export type Swot = { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };

export type TowsStrategy = { type: string; strategy: string; description: string };

export type MarketResult = {
  market: { name: string; definition: string; size: string; growth: string; basis: string };
  trends: MarketTrend[];
  shares: MarketShare[];
  competitors: Competitor[];
  swot: Swot;
  swotSubject: string;
  tows: TowsStrategy[];
  needs: CustomerNeed[];
  searched: boolean;
};
