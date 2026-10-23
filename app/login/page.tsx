"use client";

import { useEffect, useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  useEffect(() => setSetup(new URLSearchParams(window.location.search).has("setup")), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setErr(data.error || "로그인에 실패했습니다.");
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>RFP Analyzer</h1>
        <p className="sub">팀에서 공유받은 접근 비밀번호를 입력하세요.</p>
        {setup && <p className="error">관리자가 Vercel 환경변수 APP_PASSWORD(8자 이상)를 설정해야 사용할 수 있습니다.</p>}
        <label className="label" htmlFor="pw">비밀번호</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="primary" type="submit" disabled={busy || !pw}>{busy ? "확인 중…" : "들어가기"}</button>
        {err && <p className="error">{err}</p>}
      </form>
    </main>
  );
}
