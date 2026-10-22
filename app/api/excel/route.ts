import { buildWorkbook } from "@/lib/excel";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { analysis, bench } = await req.json();
  const buf = await buildWorkbook(analysis, bench ?? null);
  const name = encodeURIComponent(`RFP분석_${analysis.overview?.projectName || "결과"}.xlsx`);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    },
  });
}
