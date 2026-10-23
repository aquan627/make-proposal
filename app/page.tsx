"use client";

import { useState } from "react";
import type { Analysis, BenchmarkResult, MarketResult } from "@/lib/types";
import { SAMPLE_RFP } from "@/lib/sample";
import { maskPII, reportText, reportTotal, safeUrl, type MaskReport } from "@/lib/pii";

const PAID = process.env.NEXT_PUBLIC_GEMINI_PAID === "on";

type Step = "idle" | "analyzing" | "researching" | "done";
const MAX_PDF_MB = 3;

const TABS = ["사업개요", "요구사항", "AS-IS", "시장트렌드", "고객니즈", "경쟁사", "SWOT", "벤치마킹", "갭분석", "추진전략"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [benchError, setBenchError] = useState("");
  const [market, setMarket] = useState<MarketResult | null>(null);
  const [marketError, setMarketError] = useState("");
  const [company, setCompany] = useState("");
  const [tab, setTab] = useState<Tab>("사업개요");
  const [downloading, setDownloading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sentMasking, setSentMasking] = useState<MaskReport | null>(null);

  // 입력 즉시 개인정보 탐지 결과를 보여줌 (서버에서도 한 번 더 마스킹)
  const preview = text.trim() ? maskPII(text).report : {};
  const previewCount = reportTotal(preview);

  const busy = step === "analyzing" || step === "researching";

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`PDF는 ${MAX_PDF_MB}MB 이하만 올릴 수 있습니다. 큰 파일은 요구사항 부분 텍스트를 붙여넣어 주세요.`);
      return;
    }
    const buf = await f.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    setPdf({ name: f.name, base64: btoa(bin) });
    setError("");
  }

  async function run() {
    setError("");
    setBenchError("");
    setMarketError("");
    setAnalysis(null);
    setBench(null);
    setMarket(null);
    setTab("사업개요");
    setSentMasking(null);
    setStep("analyzing");
    try {
      // 텍스트는 브라우저에서 먼저 마스킹한 뒤 전송
      const body = text.trim() ? { text: maskPII(text).text, consent } : { pdfBase64: pdf?.base64, consent };
      const r1 = await post("/api/analyze", body);
      const { masking, maskedCount, ...rest } = r1;
      setSentMasking(text.trim() ? preview : masking ?? {});
      void maskedCount;
      setAnalysis(rest);
      setStep("researching");
      // 2단계(벤치마킹)와 3단계(시장 분석)는 동시에 실행
      await Promise.allSettled([
        post("/api/benchmark", { analysis: rest }).then(setBench, (e) => setBenchError(msg(e))),
        post("/api/market", { analysis: rest, company: maskPII(company).text }).then(setMarket, (e) => setMarketError(msg(e))),
      ]);
      setStep("done");
    } catch (e) {
      setError(msg(e));
      setStep("idle");
    }
  }

  async function download() {
    if (!analysis) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, bench, market }),
      });
      if (!res.ok) throw new Error("엑셀 생성에 실패했습니다.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `RFP분석_${String(analysis.overview.projectName || "결과").replace(/[\\/:*?"<>|]/g, "")}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(msg(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main>
      <header className="top row between wrap">
        <div>
          <h1>RFP Analyzer</h1>
          <p className="sub">제안요청서를 넣으면 사업 분석, 시장·경쟁·SWOT·고객 니즈, 벤치마킹·갭, 추진전략을 엑셀로 정리합니다.</p>
        </div>
        <button className="ghost" onClick={logout}>로그아웃</button>
      </header>

      <section className="card">
        <div className="row between">
          <label className="label" htmlFor="rfp">RFP 내용</label>
          <button className="ghost" onClick={() => { setText(SAMPLE_RFP); setPdf(null); }} disabled={busy}>
            샘플 RFP 불러오기
          </button>
        </div>
        <textarea
          id="rfp"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="RFP 본문을 붙여넣거나, 아래에서 PDF를 올려주세요."
          disabled={busy}
        />
        <div className="row between wrap">
          <label className="file">
            <input type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
            {pdf ? `📄 ${pdf.name}` : `PDF 업로드 (최대 ${MAX_PDF_MB}MB)`}
          </label>
          {pdf && <button className="ghost" onClick={() => setPdf(null)} disabled={busy}>PDF 제거</button>}
          <button className="primary" onClick={run} disabled={busy || !consent || (!text.trim() && !pdf)}>
            {busy ? "분석 중…" : "분석 시작"}
          </button>
        </div>
        <details className="company">
          <summary>우리 회사 정보 (선택) — SWOT의 강점·약점에 반영됩니다</summary>
          <textarea
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value.slice(0, 4000))}
            placeholder="예: 은행 지급결제 구축 레퍼런스 3건, 자체 정산 솔루션 보유, 클라우드 전환 경험 부족 등"
            disabled={busy}
          />
        </details>
        {text.trim() && (
          <p className={previewCount ? "pii warn-box" : "pii ok-box"}>
            {previewCount
              ? `개인정보로 보이는 항목 ${previewCount}건을 가린 뒤 전송합니다: ${reportText(preview)}`
              : "개인정보로 보이는 항목이 없습니다. (이름·주소 등 형식이 없는 정보는 직접 확인하세요)"}
          </p>
        )}
        {pdf && !text.trim() && <p className="pii ok-box">PDF는 서버에서 글자만 추출하고 개인정보를 가린 뒤 전송합니다. 원본 파일은 외부 AI로 보내거나 저장하지 않습니다.</p>}
        <label className="consent">
          <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
          <span>
            {PAID
              ? "입력 내용이 Google Gemini API(유료 등급, 학습 미사용)로 전송됨을 확인했습니다. 대외비 RFP는 회사 보안 정책에 따라 사용합니다."
              : "입력 내용이 Google Gemini 무료 API로 전송되며, 무료 등급에서는 Google이 서비스 개선과 사람 검토에 사용할 수 있음을 확인했습니다. 대외비·고객 정보가 포함된 RFP는 넣지 않습니다."}
          </span>
        </label>
        {error && <p className="error">{error}</p>}
      </section>

      {step !== "idle" && (
        <section className="steps">
          <StepItem label="1. RFP 분석 (개요·요구사항·AS-IS·전략)" state={step === "analyzing" ? "run" : "ok"} />
          <StepItem
            label="2. 벤치마킹 · 갭 분석"
            state={step === "analyzing" ? "wait" : step === "researching" && !bench && !benchError ? "run" : benchError ? "fail" : "ok"}
          />
          <StepItem
            label="3. 시장 트렌드 · 점유율 · 경쟁사 · SWOT · 고객 니즈"
            state={step === "analyzing" ? "wait" : step === "researching" && !market && !marketError ? "run" : marketError ? "fail" : "ok"}
          />
          {sentMasking && reportTotal(sentMasking) > 0 && <p className="small muted">전송 전 개인정보 마스킹: {reportText(sentMasking)}</p>}
          {benchError && <p className="error small">벤치마킹 실패: {benchError} (나머지 결과는 다운로드할 수 있습니다)</p>}
          {marketError && <p className="error small">시장 분석 실패: {marketError} (나머지 결과는 다운로드할 수 있습니다)</p>}
        </section>
      )}

      {analysis && (
        <section className="card">
          <div className="row between wrap">
            <h2>{analysis.overview.projectName}</h2>
            <button className="primary" onClick={download} disabled={downloading || step === "researching"}>
              {downloading ? "생성 중…" : "엑셀 다운로드"}
            </button>
          </div>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t} className={t === tab ? "tab on" : "tab"} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
          <div className="tabbody">
            {tab === "사업개요" && <OverviewView a={analysis} />}
            {tab === "요구사항" && (
              <Table
                cols={[["id", "ID"], ["category", "분류"], ["name", "요구사항명"], ["description", "상세"], ["priority", "중요도"], ["response", "대응방안"]]}
                rows={analysis.requirements}
              />
            )}
            {tab === "AS-IS" && (
              <Table cols={[["area", "영역"], ["current", "현행"], ["issue", "문제점"], ["toConfirm", "확인 필요"]]} rows={analysis.asis} />
            )}
            {tab === "시장트렌드" && (
              <Pending ready={!!market} failed={!!marketError} what="시장 분석">
                {market && <MarketView m={market} />}
              </Pending>
            )}
            {tab === "고객니즈" && (
              <Pending ready={!!market} failed={!!marketError} what="시장 분석">
                <Table
                  cols={[["segment", "고객군"], ["need", "니즈"], ["painPoint", "현재 불편"], ["priority", "중요도"], ["response", "제안 반영 방안"], ["linkedRequirements", "연계 요구사항"]]}
                  rows={market?.needs ?? []}
                />
              </Pending>
            )}
            {tab === "경쟁사" && (
              <Pending ready={!!market} failed={!!marketError} what="시장 분석">
                {market && <CompetitorView m={market} />}
              </Pending>
            )}
            {tab === "SWOT" && (
              <Pending ready={!!market} failed={!!marketError} what="시장 분석">
                {market && <SwotView m={market} />}
              </Pending>
            )}
            {tab === "벤치마킹" && (
              <Pending ready={!!bench} failed={!!benchError}>
                {bench && !bench.searched && (
                  <p className="callout">웹 검색 없이 AI가 알고 있는 사례로 작성한 초안입니다. 사례명·연도·수치는 출처를 확인한 뒤 사용하세요.</p>
                )}
                <Table
                  cols={[["organization", "기관"], ["caseName", "사례"], ["year", "연도"], ["implication", "시사점"], ["sourceName", "출처"], ["sourceUrl", "링크"]]}
                  rows={bench?.benchmarks ?? []}
                />
              </Pending>
            )}
            {tab === "갭분석" && (
              <Pending ready={!!bench} failed={!!benchError}>
                <Table
                  cols={[["area", "영역"], ["asis", "AS-IS"], ["tobe", "TO-BE"], ["gap", "Gap"], ["task", "개선과제"], ["priority", "우선순위"]]}
                  rows={bench?.gaps ?? []}
                />
              </Pending>
            )}
            {tab === "추진전략" && (
              <Table
                cols={[["strategy", "전략"], ["description", "내용"], ["linkedRequirements", "연계 요구사항"], ["differentiation", "차별화"]]}
                rows={analysis.strategies}
              />
            )}
          </div>
        </section>
      )}

      <footer className="foot">AI가 생성한 초안입니다. 제안서 반영 전 반드시 검토하세요. 입력한 RFP와 결과는 이 서버에 저장되지 않습니다.</footer>
    </main>
  );
}

function StepItem({ label, state }: { label: string; state: "wait" | "run" | "ok" | "fail" }) {
  const icon = { wait: "○", run: "◐", ok: "●", fail: "✕" }[state];
  return <div className={`step ${state}`}><span className="icon">{icon}</span>{label}</div>;
}

function Pending({ ready, failed, what = "벤치마킹", children }: { ready: boolean; failed: boolean; what?: string; children: React.ReactNode }) {
  if (failed) return <p className="muted">{what} 단계가 실패했습니다.</p>;
  if (!ready) return <p className="muted">{what} 결과를 작성하는 중입니다. 1~2분 걸릴 수 있습니다.</p>;
  return <>{children}</>;
}

function EstimateNote({ m }: { m: MarketResult }) {
  if (m.searched) return null;
  return <p className="callout">웹 검색 없이 AI가 알고 있는 정보로 작성한 초안입니다. 시장 규모·점유율·경쟁사 정보는 &quot;AI 추정&quot;이므로 공시·보도자료 등으로 확인한 뒤 사용하세요.</p>;
}

function MarketView({ m }: { m: MarketResult }) {
  const rows: [string, string][] = [
    ["시장", m.market.name],
    ["시장 정의", m.market.definition],
    ["시장 규모", m.market.size],
    ["성장성", m.market.growth],
    ["근거·확인 자료", m.market.basis],
  ];
  return (
    <>
      <EstimateNote m={m} />
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <h3 className="sec">주요 트렌드</h3>
      <Table cols={[["trend", "트렌드"], ["description", "내용"], ["impact", "영향도"], ["implication", "본 사업 시사점"]]} rows={m.trends} />
    </>
  );
}

function CompetitorView({ m }: { m: MarketResult }) {
  return (
    <>
      <EstimateNote m={m} />
      <h3 className="sec">시장 점유율</h3>
      <div className="shares">
        {m.shares.map((s, i) => (
          <div className="share" key={i}>
            <span className="share-name">{s.company}</span>
            <span className="share-track" aria-hidden="true">
              {s.shareValue != null && <span className="share-bar" style={{ width: `${Math.min(100, s.shareValue)}%` }} />}
            </span>
            <span className="share-val">{s.share || "확인 필요"}</span>
            <span className={s.verified ? "tag ok" : "tag"}>{s.verified ? "검색 확인" : "AI 추정"}</span>
          </div>
        ))}
      </div>
      <p className="small muted">근거: {m.shares.map((s) => `${s.company} — ${s.basis}`).join(" / ")}</p>
      <h3 className="sec">경쟁사 특장점</h3>
      <Table
        cols={[["company", "업체"], ["offering", "주력 솔루션"], ["strengths", "특장점"], ["weaknesses", "약점·한계"], ["references", "유사 레퍼런스"], ["ourResponse", "대응 포인트"]]}
        rows={m.competitors}
      />
    </>
  );
}

function SwotView({ m }: { m: MarketResult }) {
  const q: [string, string, string[]][] = [
    ["s", "S · 강점", m.swot.strengths],
    ["w", "W · 약점", m.swot.weaknesses],
    ["o", "O · 기회", m.swot.opportunities],
    ["t", "T · 위협", m.swot.threats],
  ];
  return (
    <>
      <p className="small muted">분석 기준: {m.swotSubject}</p>
      <div className="swot">
        {q.map(([k, label, items]) => (
          <div key={k} className={`quad ${k}`}>
            <h4>{label}</h4>
            <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <h3 className="sec">SWOT 교차 전략</h3>
      <Table cols={[["type", "구분"], ["strategy", "전략"], ["description", "내용"]]} rows={m.tows} />
    </>
  );
}

function OverviewView({ a }: { a: Analysis }) {
  const o = a.overview;
  const rows: [string, React.ReactNode][] = [
    ["발주기관", o.client],
    ["사업기간", o.period],
    ["사업예산", o.budget],
    ["추진배경", o.background],
    ["사업목적", o.purpose],
    ["사업목표", <ul key="g">{o.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>],
    ["사업범위", <ul key="s">{o.scope.map((g, i) => <li key={i}>{g}</li>)}</ul>],
    ["기대효과", <ul key="e">{o.expectedEffects.map((e, i) => <li key={i}><b>[{e.type}]</b> {e.effect}</li>)}</ul>],
  ];
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function Table<T extends object>({ cols, rows }: { cols: [string, string][]; rows: T[] }) {
  if (!rows.length) return <p className="muted">결과가 없습니다.</p>;
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(([k]) => {
                const v = String((r as Record<string, unknown>)[k] ?? "");
                return (
                  <td key={k}>
                    {k === "sourceUrl" ? (
                      safeUrl(v) ? <a href={safeUrl(v)} target="_blank" rel="noopener noreferrer">열기</a> : <span className="warn">확인 필요</span>
                    ) : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function logout() {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/login";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function post(url: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("서버와 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  }
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("로그인이 필요합니다.");
  }
  let text = "";
  try {
    // 처리 중에는 연결 유지용 공백이 먼저 오고, 마지막에 JSON이 옵니다.
    text = await res.text();
  } catch {
    throw new Error("처리 도중 연결이 끊겼습니다. 회사망 프록시가 긴 요청을 끊었을 수 있습니다. 다시 시도하거나 RFP 일부만 넣어보세요.");
  }
  let data: { error?: string } & Record<string, unknown>;
  try {
    data = JSON.parse(text.trim());
  } catch {
    if (res.status === 413) throw new Error("파일이 너무 큽니다. 3MB 이하 PDF나 텍스트로 넣어주세요.");
    if (res.status === 504) throw new Error("처리 시간이 초과됐습니다. RFP 분량을 줄여 다시 시도해 주세요.");
    throw new Error(`서버 오류가 발생했습니다 (${res.status}). 잠시 후 다시 시도해 주세요.`);
  }
  if (!res.ok || data.error) throw new Error(data.error || `서버 오류 (${res.status})`);
  return data;
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
