import { benchmarkAndGap } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { analysis } = await req.json();
    const result = await benchmarkAndGap(analysis);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status: 500 });
  }
}
