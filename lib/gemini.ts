import { GoogleGenAI, ApiError } from "@google/genai";
import type { Analysis, BenchmarkResult } from "./types";

// LLM 호출은 이 파일에만 모여 있습니다.
// 다른 모델(사내 LLM 등)로 바꿀 때는 이 파일만 교체하면 됩니다.
export const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Google 검색 연동은 Gemini 무료 등급에서 제공되지 않습니다. 유료 키일 때만 "on"으로 설정하세요.
const USE_SEARCH = (process.env.GEMINI_SEARCH || "").toLowerCase() === "on";

function client() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  return new GoogleGenAI({ apiKey });
}

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    const m = e.message || "";
    if (e.status === 429) return "Gemini 무료 사용 한도를 넘었습니다. 1~2분 뒤 다시 시도하거나 내일 다시 시도해 주세요.";
    if (e.status === 400 && /api key/i.test(m)) return "Gemini API 키가 올바르지 않습니다. Vercel의 GEMINI_API_KEY 값을 확인하세요.";
    if (e.status === 403) return "이 API 키로는 해당 기능이나 모델을 쓸 수 없습니다. (" + m.slice(0, 160) + ")";
    if (e.status === 404) return `모델(${MODEL})을 찾을 수 없습니다. GEMINI_MODEL 값을 확인하세요.`;
    if (e.status >= 500) return "Gemini 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.";
    return `Gemini 오류 (${e.status}): ${m.slice(0, 200)}`;
  }
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
}

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;
const level = { type: "string", enum: ["상", "중", "하"] } as const;

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
            properties: { type: { type: "string", enum: ["정량", "정성"] }, effect: str },
          },
        },
      },
    },
    requirements: {
      type: "array",
      description: "RFP의 요구사항을 빠짐없이 추출. RFP에 요구사항 ID가 있으면 그대로 사용하고, 없으면 REQ-001부터 부여",
      items: {
        type: "object",
        required: ["id", "category", "name", "description", "priority", "difficulty", "response"],
        properties: {
          id: str,
          category: { ...str, description: "기능/성능/보안/인터페이스/데이터/품질/제약/프로젝트관리/프로젝트지원 등" },
          name: str,
          description: str,
          priority: level,
          difficulty: level,
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
    benchmarkTopics: { ...strArr, description: "동종업계 벤치마킹 시 조사할 주제 3~5개" },
  },
};

const benchSchema = {
  type: "object",
  required: ["benchmarks", "gaps"],
  properties: {
    benchmarks: {
      type: "array",
      items: {
        type: "object",
        required: ["organization", "caseName", "year", "summary", "implication", "source"],
        properties: {
          organization: str,
          caseName: str,
          year: { ...str, description: "확실하지 않으면 '확인 필요'" },
          summary: str,
          implication: { ...str, description: "본 사업 시사점" },
          source: { ...str, description: "확인에 쓸 자료명(보도자료·공시·기사 등). 모르면 빈 문자열. URL을 지어내지 말 것" },
        },
      },
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        required: ["area", "asis", "tobe", "benchmark", "gap", "task", "priority"],
        properties: {
          area: str, asis: str, tobe: str,
          benchmark: { ...str, description: "참고 사례 기관명" },
          gap: str,
          task: { ...str, description: "개선과제" },
          priority: level,
        },
      },
    },
  },
};

const RULES = `당신은 금융권 SI 제안 전문 컨설턴트입니다. 제안요청서(RFP)를 분석해 제안서 작성용 기초 자료를 만듭니다.
- 모든 내용은 한국어 제안서 문체(개조식, '~함', '~필요' 등)로 작성합니다.
- RFP에 근거가 있는 사실과 제안사로서의 해석·제안을 구분합니다. RFP에 없는 수치·현황은 지어내지 않습니다.
- 요구사항은 누락 없이 추출합니다.`;

function parseJson(text: string | undefined) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export async function analyzeRfp(input: { text?: string; pdfBase64?: string }): Promise<Analysis> {
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
  if (input.pdfBase64) parts.push({ inlineData: { mimeType: "application/pdf", data: input.pdfBase64 } });
  parts.push({
    text: input.text ? `다음 RFP를 분석하세요.\n\n<rfp>\n${input.text}\n</rfp>` : "첨부한 RFP를 분석하세요.",
  });

  const res = await client().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: RULES,
      responseMimeType: "application/json",
      responseJsonSchema: analysisSchema,
      maxOutputTokens: 32000,
    },
  });

  if (res.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new Error("RFP가 너무 길어 결과가 잘렸습니다. 요구사항 부분만 나눠서 넣어보세요.");
  }
  const parsed = parseJson(res.text);
  if (!parsed?.overview || !Array.isArray(parsed.requirements)) {
    throw new Error("분석 결과를 해석하지 못했습니다. 다시 시도해 주세요.");
  }
  return parsed as Analysis;
}

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

  const searchRule = USE_SEARCH
    ? "Google 검색으로 실제 사례를 확인한 뒤 작성합니다. source에는 근거가 된 웹페이지의 사이트명 또는 기사 제목을 씁니다."
    : "지금은 웹 검색을 할 수 없습니다. 실제로 알려진 공개 사례만 쓰고, 확실하지 않으면 기관명을 일반화합니다(예: '국내 시중은행'). 연도·수치가 확실하지 않으면 '확인 필요'라고 씁니다.";

  const prompt = `다음 사업에 대해 동종업계 벤치마킹 사례 3~5건을 정리하고, 현행(AS-IS)과 목표(TO-BE) 간 갭 분석을 5~8개 항목으로 작성하세요.
국내 금융권 사례를 우선하고, 부족하면 해외 사례로 보충합니다. ${searchRule}
URL은 지어내지 마세요. 한국어 제안서 문체(개조식)로 작성합니다.
${USE_SEARCH ? `\n결과는 설명 없이 아래 형식의 JSON 하나만 출력합니다.\n${JSON.stringify(benchSchema)}\n` : ""}
<project>
${JSON.stringify(brief, null, 2)}
</project>`;

  const res = await client().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: USE_SEARCH
      ? { tools: [{ googleSearch: {} }], maxOutputTokens: 16000 }
      : { responseMimeType: "application/json", responseJsonSchema: benchSchema, maxOutputTokens: 16000 },
  });

  const parsed = parseJson(res.text);
  if (!parsed) throw new Error("벤치마킹 결과를 해석하지 못했습니다. 다시 시도해 주세요.");

  // 검색을 쓴 경우: 실제 검색 출처와 대조해 링크를 붙이고 '검색 확인'으로 표시
  const chunks = (res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => !!w?.uri);
  const findChunk = (source: string) => {
    const s = source.toLowerCase().trim();
    if (!s) return undefined;
    return chunks.find((w) => {
      const t = (w.title || "").toLowerCase();
      return t && (s.includes(t) || t.includes(s));
    });
  };

  return {
    benchmarks: (parsed.benchmarks ?? []).map((b: Record<string, string>) => {
      const hit = USE_SEARCH ? findChunk(b.source ?? "") : undefined;
      return {
        organization: b.organization ?? "",
        caseName: b.caseName ?? "",
        year: b.year ?? "",
        summary: b.summary ?? "",
        implication: b.implication ?? "",
        sourceUrl: hit?.uri ?? "",
        sourceName: b.source ?? "",
        verified: !!hit,
      };
    }),
    gaps: parsed.gaps ?? [],
    searched: USE_SEARCH,
  };
}
