import { extractText, getDocumentProxy } from "unpdf";

// PDF는 서버에서 텍스트만 추출합니다. 원본 파일은 외부 AI로 보내지 않고 저장하지도 않습니다.
export async function extractPdfText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}
