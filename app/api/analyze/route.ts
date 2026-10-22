import { analyzeRfp } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { text, pdfBase64 } = await req.json();
    if (!text?.trim() && !pdfBase64) {
      return Response.json({ error: "RFP 내용을 입력하거나 PDF를 올려주세요." }, { status: 400 });
    }
    const analysis = await analyzeRfp({ text: text?.trim() || undefined, pdfBase64 });
    return Response.json(analysis);
  } catch (e) {
    return Response.json({ error: errMsg(e) }, { status: 500 });
  }
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
}
