import { friendlyError, marketAnalysis } from "@/lib/gemini";
import { clientIp, errorResponse, GuardError, rateLimit, readJson } from "@/lib/guard";
import { maskDeep, maskPII } from "@/lib/pii";
import { streamJson } from "@/lib/stream";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let analysis: Analysis;
  let company = "";
  try {
    if (!rateLimit("ai:" + clientIp(req), 20, 10 * 60 * 1000)) {
      throw new GuardError("요청이 너무 많습니다. 몇 분 뒤 다시 시도해 주세요.", 429);
    }
    const body = await readJson<{ analysis?: Analysis; company?: string }>(req, 320_000);
    if (!body.analysis?.overview || !Array.isArray(body.analysis.requirements) || !Array.isArray(body.analysis.asis)) {
      throw new GuardError("분석 결과 형식이 올바르지 않습니다.", 400);
    }
    if (typeof body.company === "string" && body.company.length > 4000) {
      throw new GuardError("제안사 정보는 4,000자 이내로 입력해 주세요.", 413);
    }
    analysis = body.analysis;
    company = typeof body.company === "string" ? body.company : "";
  } catch (e) {
    return errorResponse(e, friendlyError);
  }
  // 외부 AI 전송 전 개인정보 마스킹
  return streamJson(() => marketAnalysis(maskDeep(analysis), maskPII(company).text), friendlyError);
}
