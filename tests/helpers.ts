import { expect } from "vitest";

let ipSeq = 0;

// 테스트마다 다른 IP를 써서 호출 횟수 제한(rate limit)이 서로 영향을 주지 않게 함
export function jsonRequest(path: string, body: unknown, init: { origin?: string; contentType?: string; cookie?: string } = {}) {
  ipSeq += 1;
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": init.contentType ?? "application/json",
    host: "rfp.test",
    "x-forwarded-for": `10.0.0.${ipSeq}`,
    "content-length": String(Buffer.byteLength(raw)),
  };
  if (init.origin) headers.origin = init.origin;
  if (init.cookie) headers.cookie = init.cookie;
  return new Request(`https://rfp.test${path}`, { method: "POST", headers, body: raw });
}

// 스트리밍 응답: 연결 유지용 공백 뒤에 JSON 한 덩어리
export async function readStreamJson(res: Response) {
  const text = await res.text();
  expect(text.startsWith(" ")).toBe(true);
  return JSON.parse(text.trim());
}
