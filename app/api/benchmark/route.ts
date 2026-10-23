import { benchmarkAndGap, friendlyError } from "@/lib/gemini";
import { clientIp, errorResponse, GuardError, rateLimit, readJson } from "@/lib/guard";
import { maskDeep } from "@/lib/pii";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    if (!rateLimit("ai:" + clientIp(req), 12, 10 * 60 * 1000)) {
      throw new GuardError("요청이 너무 많습니다. 몇 분 뒤 다시 시도해 주세요.", 429);
    }
    const { analysis } = await readJson<{ analysis?: Analysis }>(req, 300_000);
    if (!analysis?.overview || !Array.isArray(analysis.asis) || !Array.isArray(analysis.strategies)) {
      throw new GuardError("분석 결과 형식이 올바르지 않습니다.", 400);
    }
    const result = await benchmarkAndGap(maskDeep(analysis));
    return Response.json(result);
  } catch (e) {
    return errorResponse(e, friendlyError);
  }
}
