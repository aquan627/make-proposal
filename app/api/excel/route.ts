import { buildWorkbook } from "@/lib/excel";
import { errorResponse, GuardError, readJson } from "@/lib/guard";
import type { Analysis, BenchmarkResult, MarketResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { analysis, bench, market } = await readJson<{ analysis?: Analysis; bench?: BenchmarkResult; market?: MarketResult }>(req, 1_500_000);
    if (!analysis?.overview) throw new GuardError("분석 결과가 없습니다.", 400);
    const buf = await buildWorkbook(analysis, bench ?? null, market?.market && market?.swot ? market : null);
    const name = encodeURIComponent(`RFP분석_${String(analysis.overview.projectName || "결과").replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 60)}.xlsx`);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e, () => "엑셀 생성에 실패했습니다.");
  }
}
