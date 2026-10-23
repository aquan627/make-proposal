// API 공통 방어: 출처 확인(CSRF), 요청 크기 제한, 호출 횟수 제한
// 호출 횟수 제한은 서버 인스턴스별 메모리 방식이라 완벽하지 않습니다(서버리스 특성). 1차 방어용입니다.

const buckets = new Map<string, { count: number; reset: number }>();

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return b.count <= limit;
}

export class GuardError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// JSON POST만 허용하고, 다른 사이트에서 보낸 요청은 거절합니다.
export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes: number): Promise<T> {
  if (!(req.headers.get("content-type") || "").includes("application/json")) {
    throw new GuardError("잘못된 요청 형식입니다.", 415);
  }
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new GuardError("허용되지 않은 출처의 요청입니다.", 403);
  }
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new GuardError("요청 크기가 너무 큽니다.", 413);
  const raw = await req.text();
  if (raw.length > maxBytes) throw new GuardError("요청 크기가 너무 큽니다.", 413);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new GuardError("요청 내용을 읽지 못했습니다.", 400);
  }
}

export function errorResponse(e: unknown, fallback: (e: unknown) => string) {
  if (e instanceof GuardError) return Response.json({ error: e.message }, { status: e.status });
  // 서버 로그에는 RFP 본문이나 외부 API 응답 원문을 남기지 않습니다.
  const status = (e as { status?: number })?.status;
  console.error("[api] failed", status ?? (e instanceof Error ? e.name : "unknown"));
  return Response.json({ error: fallback(e) }, { status: 500 });
}
