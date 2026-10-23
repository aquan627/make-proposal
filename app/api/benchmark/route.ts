import { benchmarkAndGap, friendlyError } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { analysis } = await req.json();
    const result = await benchmarkAndGap(analysis);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: friendlyError(e) }, { status: 500 });
  }
}
