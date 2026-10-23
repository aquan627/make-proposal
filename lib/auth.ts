// 접근 제어: APP_PASSWORD 환경변수로 보호합니다.
// 쿠키에는 비밀번호가 아니라 HMAC 서명만 저장합니다.

export const AUTH_COOKIE = "rfp_session";
export const SESSION_HOURS = 12;

const enc = new TextEncoder();

function password() {
  return process.env.APP_PASSWORD || "";
}

async function hmac(message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authConfigured() {
  return password().length >= 8;
}

export async function checkPassword(input: unknown) {
  if (!authConfigured() || typeof input !== "string") return false;
  // 길이 차이로 정보가 새지 않도록 해시끼리 비교
  return safeEqual(await hmac("pw:" + input), await hmac("pw:" + password()));
}

export async function createSession() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${await hmac("session:" + exp)}`;
}

export async function verifySession(token: string | undefined) {
  if (!token || !authConfigured()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac("session:" + exp));
}
