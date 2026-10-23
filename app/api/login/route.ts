import { AUTH_COOKIE, SESSION_HOURS, authConfigured, checkPassword, createSession } from "@/lib/auth";
import { clientIp, errorResponse, rateLimit, readJson } from "@/lib/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!authConfigured()) {
      return Response.json({ error: "관리자가 APP_PASSWORD를 설정해야 사용할 수 있습니다." }, { status: 503 });
    }
    if (!rateLimit("login:" + clientIp(req), 10, 10 * 60 * 1000)) {
      return Response.json({ error: "로그인 시도가 너무 많습니다. 10분 뒤 다시 시도해 주세요." }, { status: 429 });
    }
    const { password } = await readJson<{ password?: string }>(req, 2_000);
    if (!(await checkPassword(password))) {
      return Response.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
    }
    const res = Response.json({ ok: true });
    res.headers.append(
      "Set-Cookie",
      `${AUTH_COOKIE}=${await createSession()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`,
    );
    return res;
  } catch (e) {
    return errorResponse(e, () => "로그인 처리 중 오류가 발생했습니다.");
  }
}
