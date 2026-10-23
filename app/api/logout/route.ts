import { AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", `${AUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return res;
}
