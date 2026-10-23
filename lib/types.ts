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
