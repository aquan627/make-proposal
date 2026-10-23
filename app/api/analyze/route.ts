import { analyzeRfp, friendlyError } from "@/lib/gemini";

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
    return Response.json({ error: friendlyError(e) }, { status: 500 });
  }
}
