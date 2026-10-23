"use client";

import { useState } from "react";
import type { Analysis, BenchmarkResult } from "@/lib/types";
import { SAMPLE_RFP } from "@/lib/sample";
import { maskPII, reportText, reportTotal, safeUrl, type MaskReport } from "@/lib/pii";

const PAID = process.env.NEXT_PUBLIC_GEMINI_PAID === "on";

type Step = "idle" | "analyzing" | "benchmarking" | "done";
const MAX_PDF_MB = 3;

const TABS = ["사업개요", "요구사항", "AS-IS", "벤치마킹", "갭분석", "추진전략"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [bench, setBench] = useState<BenchmarkResult | null>(null);
  const [benchError, setBenchError] = useState("");
  const [tab, setTab] = useState<Tab>("사업개요");
  const [downloading, setDownloading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sentMasking, setSentMasking] = useState<MaskReport | null>(null);

  // 입력 즉시 개인정보 탐지 결과를 보여줌 (서버에서도 한 번 더 마스킹)
  const preview = text.trim() ? maskPII(text).report : {};
  const previewCount = reportTotal(preview);

  const busy = step === "analyzing" || step === "benchmarking";

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
    setAnalysis(null);
    setBench(null);
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
      setStep("benchmarking");
      try {
        const r2 = await post("/api/benchmark", { analysis: r1 });
        setBench(r2);
      } catch (e) {
        setBenchError(msg(e));
      }
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
        body: JSON.stringify({ analysis, bench }),
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
          <p className="sub">제안요청서를 넣으면 사업개요 · 요구사항 · AS-IS · 벤치마킹 · 갭분석 · 추진전략을 엑셀로 정리합니다.</p>
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
            state={step === "analyzing" ? "wait" : step === "benchmarking" ? "run" : benchError ? "fail" : "ok"}
          />
          {sentMasking && reportTotal(sentMasking) > 0 && <p className="small muted">전송 전 개인정보 마스킹: {reportText(sentMasking)}</p>}
          {benchError && <p className="error small">벤치마킹 실패: {benchError} (1단계 결과는 다운로드할 수 있습니다)</p>}
        </section>
      )}

      {analysis && (
        <section className="card">
          <div className="row between wrap">
            <h2>{analysis.overview.projectName}</h2>
            <button className="primary" onClick={download} disabled={downloading || step === "benchmarking"}>
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

function Pending({ ready, failed, children }: { ready: boolean; failed: boolean; children: React.ReactNode }) {
  if (failed) return <p className="muted">벤치마킹 단계가 실패했습니다.</p>;
  if (!ready) return <p className="muted">벤치마킹 사례와 갭 분석을 작성하는 중입니다. 1~2분 걸릴 수 있습니다.</p>;
  return <>{children}</>;
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

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: res.status === 413 ? "파일이 너무 큽니다." : `서버 오류 (${res.status})` }));
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("로그인이 필요합니다.");
  }
  if (!res.ok || data.error) throw new Error(data.error || `서버 오류 (${res.status})`);
  return data;
}

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
