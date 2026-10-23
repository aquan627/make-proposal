import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authConfigured, verifySession } from "@/lib/auth";

// 로그인하지 않은 사용자는 화면과 API 모두 접근할 수 없습니다.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!authConfigured()) {
    const msg = "APP_PASSWORD 환경변수(8자 이상)가 설정되지 않아 앱이 잠겨 있습니다.";
    if (isApi) return NextResponse.json({ error: msg }, { status: 503 });
    if (pathname !== "/login") return NextResponse.redirect(new URL("/login?setup=1", req.url));
    return NextResponse.next();
  }

  const ok = await verifySession(req.cookies.get(AUTH_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: "로그인이 필요합니다. 페이지를 새로고침해 주세요." }, { status: 401 });
  if (pathname === "/login") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api/login|_next/static|_next/image|favicon.ico).*)"],
};
