import { analyzeRfp, friendlyError } from "@/lib/gemini";
import { clientIp, errorResponse, GuardError, rateLimit, readJson } from "@/lib/guard";
import { maskPII, reportTotal } from "@/lib/pii";
import { extractPdfText } from "@/lib/pdf";
import { streamJson } from "@/lib/stream";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TEXT = 150_000; // 글자
const MAX_PDF_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  let source = "";
  let pdf: Buffer | null = null;
  try {
    if (!rateLimit("ai:" + clientIp(req), 20, 10 * 60 * 1000)) {
      throw new GuardError("요청이 너무 많습니다. 몇 분 뒤 다시 시도해 주세요.", 429);
    }
    const { text, pdfBase64, consent } = await readJson<{ text?: string; pdfBase64?: string; consent?: boolean }>(req, 4_400_000);
    if (consent !== true) throw new GuardError("데이터 전송 안내에 동의해야 분석할 수 있습니다.", 400);

    source = typeof text === "string" ? text.trim() : "";
    if (!source && typeof pdfBase64 === "string" && pdfBase64) {
      pdf = Buffer.from(pdfBase64, "base64");
      if (pdf.length > MAX_PDF_BYTES) throw new GuardError("PDF는 3MB 이하만 올릴 수 있습니다.", 413);
      if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new GuardError("PDF 파일이 아닙니다.", 400);
    }
    if (!source && !pdf) throw new GuardError("RFP 내용을 입력하거나 PDF를 올려주세요.", 400);
  } catch (e) {
    return errorResponse(e, friendlyError);
  }

  // 오래 걸리는 작업은 연결 유지 신호를 보내며 처리
  return streamJson(async () => {
    if (pdf) {
      source = await extractPdfText(pdf);
      if (!source) throw new Error("PDF에서 글자를 찾지 못했습니다. 스캔 이미지 PDF는 지원하지 않습니다. 본문을 붙여넣어 주세요.");
    }
    if (source.length > MAX_TEXT) {
      throw new Error(`RFP가 너무 깁니다(${MAX_TEXT.toLocaleString()}자 초과). 요구사항 부분만 넣어주세요.`);
    }
    // 외부 AI로 보내기 전 개인정보 마스킹 (원본 PDF는 외부로 보내지 않음)
    const masked = maskPII(source);
    const analysis = await analyzeRfp(masked.text);
    return { ...analysis, masking: masked.report, maskedCount: reportTotal(masked.report) };
  }, friendlyError);
}
