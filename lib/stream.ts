// 오래 걸리는 AI 요청을 위한 응답 방식
// 처리하는 동안 8초마다 공백을 보내 연결을 유지합니다.
// (회사망 프록시·브라우저가 응답 없는 연결을 끊어 "Failed to fetch"가 나는 것을 막기 위함)
// 마지막에 JSON 한 덩어리를 보내며, 클라이언트는 앞뒤 공백을 지우고 파싱합니다.

export function streamJson(work: () => Promise<unknown>, onError: (e: unknown) => string): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(" "));
      const timer = setInterval(() => {
        try {
          controller.enqueue(enc.encode(" "));
        } catch {
          clearInterval(timer);
        }
      }, 8000);
      try {
        const result = await work();
        controller.enqueue(enc.encode(JSON.stringify(result)));
      } catch (e) {
        // 서버 로그에는 본문 없이 상태만 남김
        const status = (e as { status?: number })?.status;
        console.error("[api] failed", status ?? (e instanceof Error ? e.name : "unknown"));
        controller.enqueue(enc.encode(JSON.stringify({ error: onError(e) })));
      } finally {
        clearInterval(timer);
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
