import Anthropic from "@anthropic-ai/sdk";
import type { Analysis, BenchmarkResult } from "./types";

// LLM 호출은 이 파일에만 모여 있습니다.
// 사내 LLM(폐쇄망)으로 바꿀 때는 이 파일의 클라이언트/모델만 교체하면 됩니다.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return new Anthropic();
}

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

const analysisSchema = {
  type: "object",
  required: ["overview", "requirements", "asis", "strategies", "benchmarkTopics"],
  properties: {
    overview: {
      type: "object",
      required: ["projectName", "client", "background", "purpose", "goals", "scope", "period", "budget", "expectedEffects"],
      properties: {
        projectName: str,
        client: str,
        background: { ...str, description: "사업 추진 배경 (2~4문장)" },
        purpose: { ...str, description: "사업 목적 (1~2문장)" },
        goals: { ...strArr, description: "사업 목표 3~6개" },
        scope: { ...strArr, description: "사업 범위 항목" },
        period: { ...str, description: "사업 기간. RFP에 없으면 '명시 없음'" },
        budget: { ...str, description: "사업 예산. RFP에 없으면 '명시 없음'" },
        expectedEffects: {
          type: "array",
          items: {
            type: "object",
            required: ["type", "effect"],
            properties: {
              type: { type: "string", enum: ["정량", "정성"] },
              effect: str,
            },
          },
        },
      },
    },
    requirements: {
      type: "array",
      description: "RFP의 요구사항을 빠짐없이 추출. RFP에 요구사항 ID가 있으면 그대로 사용",
      items: {
        type: "object",
        required: ["id", "category", "name", "description", "priority", "difficulty", "response"],
        properties: {
          id: str,
          category: { ...str, description: "기능/성능/보안/인터페이스/데이터/품질/제약/프로젝트관리/프로젝트지원 등" },
          name: str,
          description: str,
          priority: { type: "string", enum: ["상", "중", "하"] },
          difficulty: { type: "string", enum: ["상", "중", "하"] },
          response: { ...str, description: "제안사 관점의 대응방안 (1~2문장)" },
        },
      },
    },
    asis: {
      type: "array",
      description: "RFP에 기술된 현행 업무/시스템 현황. RFP에 근거가 없는 내용은 만들지 말 것",
      items: {
        type: "object",
        required: ["area", "current", "issue", "toConfirm"],
        properties: {
          area: { ...str, description: "업무 또는 시스템 영역" },
          current: { ...str, description: "현행 현황 (RFP 근거)" },
          issue: { ...str, description: "문제점·한계" },
          toConfirm: { ...str, description: "제안 전 고객 확인이 필요한 사항" },
        },
      },
    },
    strategies: {
      type: "array",
      description: "요구사항 분석을 근거로 한 추진전략 4~6개",
      items: {
        type: "object",
        required: ["strategy", "description", "linkedRequirements", "differentiation"],
        properties: {
          strategy: { ...str, description: "전략명 (짧게)" },
          description: str,
          linkedRequirements: { ...str, description: "연계 요구사항 ID 목록 (쉼표 구분)" },
          differentiation: { ...str, description: "경쟁사 대비 차별화 포인트" },
        },
      },
    },
    benchmarkTopics: {
      ...strArr,
      description: "동종업계 벤치마킹 시 웹에서 찾아볼 주제 3~5개 (예: '국내 은행 차세대 지급결제 시스템 구축 사례')",
    },
  },
} as const;

const ANALYSIS_SYSTEM = `당신은 금융권 SI 제안 전문 컨설턴트입니다. 제안요청서(RFP)를 분석해 제안서 작성용 기초 자료를 만듭니다.
원칙:
- 모든 내용은 한국어 제안서 문체(개조식, '~함', '~필요' 등)로 작성합니다.
- RFP에 근거가 있는 사실과, 제안사로서의 해석·제안을 구분합니다. RFP에 없는 수치·현황은 지어내지 않습니다.
- 요구사항은 누락 없이 추출합니다.
- 결과는 반드시 save_analysis 도구로 제출합니다.`;

export async function analyzeRfp(input: { text?: string; pdfBase64?: string }): Promise<Analysis> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    });
  }
  content.push({
    type: "text",
    text: input.text
      ? `다음 RFP를 분석하세요.\n\n<rfp>\n${input.text}\n</rfp>`
      : "첨부한 RFP를 분석하세요.",
  });

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: ANALYSIS_SYSTEM,
    tools: [
      {
        name: "save_analysis",
        description: "RFP 분석 결과를 저장합니다.",
        input_schema: analysisSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "save_analysis" },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("분석 결과를 받지 못했습니다.");
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error("RFP가 너무 길어 결과가 잘렸습니다. 요구사항 부분만 나눠서 넣어보세요.");
  }
  return block.input as Analysis;
}

const BENCH_SYSTEM = `당신은 금융권 SI 제안 전문 컨설턴트입니다. 웹 검색으로 동종업계 사례를 조사해 벤치마킹과 갭 분석을 작성합니다.
원칙:
- 벤치마킹 사례는 반드시 웹 검색 결과에서 확인한 것만 씁니다. 기억에 의존해 사례나 수치를 만들지 않습니다.
- 각 사례의 sourceUrl에는 실제로 근거가 된 검색 결과의 URL을 그대로 넣습니다.
- 국내 금융권 사례를 우선하고, 부족하면 해외 사례를 보충합니다.
- 한국어 제안서 문체(개조식)로 작성합니다.
- 조사가 끝나면 마지막에 아래 형식의 JSON 하나만 \`\`\`json 코드블록으로 출력합니다.

{
  "benchmarks": [
    { "organization": "기관명", "caseName": "사례명", "year": "연도", "summary": "사례 요약", "implication": "본 사업 시사점", "sourceUrl": "https://..." }
  ],
  "gaps": [
    { "area": "영역", "asis": "현행", "tobe": "목표 모습", "benchmark": "참고 사례(기관명)", "gap": "차이", "task": "개선과제", "priority": "상|중|하" }
  ]
}`;

export async function benchmarkAndGap(analysis: Analysis): Promise<BenchmarkResult> {
  const brief = {
    사업명: analysis.overview.projectName,
    발주기관: analysis.overview.client,
    목적: analysis.overview.purpose,
    목표: analysis.overview.goals,
    현황: analysis.asis,
    추진전략: analysis.strategies.map((s) => s.strategy),
    조사주제: analysis.benchmarkTopics,
  };

  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: 6 },
  ];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `다음 사업에 대해 동종업계 벤치마킹 사례 3~5건을 조사하고, 현행(AS-IS)과 목표(TO-BE) 간 갭 분석을 5~8개 항목으로 작성하세요.\n\n${JSON.stringify(brief, null, 2)}`,
    },
  ];

  let res = await client().messages.create({ model: MODEL, max_tokens: 12000, system: BENCH_SYSTEM, tools, messages });
  for (let i = 0; i < 3 && res.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: res.content });
    res = await client().messages.create({ model: MODEL, max_tokens: 12000, system: BENCH_SYSTEM, tools, messages });
  }

  // 검색 결과로 실제 조회된 URL 목록 (출처 검증용)
  const seenUrls = new Set<string>();
  let text = "";
  for (const b of res.content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if ("url" in r) seenUrls.add(normalize(r.url));
    }
    if (b.type === "text") {
      text += b.text;
      for (const c of b.citations ?? []) if ("url" in c && c.url) seenUrls.add(normalize(c.url));
    }
  }

  const parsed = extractJson(text);
  if (!parsed) throw new Error("벤치마킹 결과를 해석하지 못했습니다. 다시 시도해 주세요.");

  return {
    benchmarks: (parsed.benchmarks ?? []).map((b: Record<string, string>) => ({
      organization: b.organization ?? "",
      caseName: b.caseName ?? "",
      year: b.year ?? "",
      summary: b.summary ?? "",
      implication: b.implication ?? "",
      sourceUrl: b.sourceUrl ?? "",
      verified: !!b.sourceUrl && seenUrls.has(normalize(b.sourceUrl)),
    })),
    gaps: parsed.gaps ?? [],
  };
}

function normalize(url: string) {
  return url.trim().replace(/[#?].*$/, "").replace(/\/$/, "").toLowerCase();
}

function extractJson(text: string) {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].pop()?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
