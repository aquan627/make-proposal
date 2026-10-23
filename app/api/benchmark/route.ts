import { benchmarkAndGap, friendlyError } from "@/lib/llm";
import { clientIp, errorResponse, GuardError, rateLimit, readJson } from "@/lib/guard";
import { maskDeep } from "@/lib/pii";
import { streamJson } from "@/lib/stream";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let analysis: Analysis;
  try {
    if (!rateLimit("ai:" + clientIp(req), 20, 10 * 60 * 1000)) {
      throw new GuardError("요청이 너무 많습니다. 몇 분 뒤 다시 시도해 주세요.", 429);
    }
    const body = await readJson<{ analysis?: Analysis }>(req, 300_000);
    if (!body.analysis?.overview || !Array.isArray(body.analysis.asis) || !Array.isArray(body.analysis.strategies)) {
      throw new GuardError("분석 결과 형식이 올바르지 않습니다.", 400);
    }
    analysis = body.analysis;
  } catch (e) {
    return errorResponse(e, friendlyError);
  }
  return streamJson(() => benchmarkAndGap(maskDeep(analysis)), friendlyError);
}
