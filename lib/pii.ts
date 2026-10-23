// 개인정보·민감정보 마스킹
// 외부 AI(Gemini)로 보내기 전에 서버와 브라우저 양쪽에서 같은 규칙으로 적용합니다.
// 정규식 기반이라 100% 탐지는 보장하지 않습니다. 대외비 원문은 입력하지 않는 것이 원칙입니다.

export type PiiType =
  | "주민·외국인등록번호"
  | "여권번호"
  | "운전면허번호"
  | "카드번호"
  | "전화번호"
  | "이메일"
  | "사업자등록번호"
  | "계좌번호"
  | "IP주소"
  | "성명";

export type MaskReport = Partial<Record<PiiType, number>>;

const SURNAMES = "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경";
const TITLES = "과장|대리|차장|부장|팀장|주임|사원|선임|책임|수석|이사|상무|전무|본부장|실장|센터장|PM|PL|님|씨";

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

type Rule = { type: PiiType; re: RegExp; check?: (m: string) => boolean; group?: number };

// 순서가 중요합니다: 더 구체적인 패턴을 먼저 적용합니다.
const RULES: Rule[] = [
  { type: "주민·외국인등록번호", re: /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s?[-–]?\s?[1-8]\d{6}(?!\d)/g },
  { type: "여권번호", re: /(?<![A-Za-z0-9])(?:[MSRODG]\d{8}|[MSRODG]\d{3}[A-Z]\d{4})(?![A-Za-z0-9])/g },
  { type: "운전면허번호", re: /(?<!\d)\d{2}[-\s]\d{2}[-\s]\d{6}[-\s]\d{2}(?!\d)/g },
  {
    type: "카드번호",
    re: /(?<!\d)(?:\d{4}[-\s]?){3}\d{4}(?!\d)/g,
    check: (m) => luhn(m.replace(/\D/g, "")),
  },
  { type: "이메일", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: "전화번호", re: /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g },
  { type: "전화번호", re: /(?<!\d)\(?0(?:2|[3-6][1-5]|70)\)?[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)/g },
  { type: "사업자등록번호", re: /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g },
  {
    type: "계좌번호",
    re: /(?<![\d.])\d{2,6}-\d{2,6}-\d{2,7}(?:-\d{1,3})?(?![\d.])/g,
    check: (m) => {
      const n = m.replace(/\D/g, "").length;
      return n >= 10 && n <= 16;
    },
  },
  {
    type: "IP주소",
    re: /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g,
  },
  // "담당자: 홍길동", "성명 홍길동"
  {
    type: "성명",
    re: new RegExp(`((?:담당자|성명|이름|작성자|책임자|연락처|담당)\\s*[:：]?\\s*)([${SURNAMES}][가-힣]{1,3})(?![가-힣])`, "g"),
    group: 2,
  },
  // "홍길동 과장", "김철수님"
  {
    type: "성명",
    re: new RegExp(`(?<![가-힣])([${SURNAMES}][가-힣]{1,2})\\s?(?=(?:${TITLES})(?![가-힣]))`, "g"),
    group: 1,
  },
];

const LABEL: Record<PiiType, string> = {
  "주민·외국인등록번호": "주민번호",
  여권번호: "여권번호",
  운전면허번호: "면허번호",
  카드번호: "카드번호",
  전화번호: "전화번호",
  이메일: "이메일",
  사업자등록번호: "사업자번호",
  계좌번호: "계좌번호",
  IP주소: "IP",
  성명: "성명",
};

export function maskPII(input: string): { text: string; report: MaskReport } {
  const report: MaskReport = {};
  let text = input;
  for (const rule of RULES) {
    text = text.replace(rule.re, (...args) => {
      const match = args[0] as string;
      const target = rule.group ? (args[rule.group] as string) : match;
      if (!target || target.startsWith("[")) return match;
      if (rule.check && !rule.check(target)) return match;
      report[rule.type] = (report[rule.type] ?? 0) + 1;
      const token = `[${LABEL[rule.type]} 마스킹]`;
      return rule.group ? match.replace(target, token) : token;
    });
  }
  return { text, report };
}

// 객체 안의 모든 문자열에 마스킹 적용 (2단계 요청 등)
export function maskDeep<T>(value: T, report: MaskReport = {}): T {
  if (typeof value === "string") {
    const r = maskPII(value);
    for (const [k, v] of Object.entries(r.report)) report[k as PiiType] = (report[k as PiiType] ?? 0) + (v ?? 0);
    return r.text as T;
  }
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, report)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = maskDeep(v, report);
    return out as T;
  }
  return value;
}

export function mergeReports(...reports: MaskReport[]): MaskReport {
  const out: MaskReport = {};
  for (const r of reports) for (const [k, v] of Object.entries(r)) out[k as PiiType] = (out[k as PiiType] ?? 0) + (v ?? 0);
  return out;
}

export function reportTotal(r: MaskReport) {
  return Object.values(r).reduce((a, b) => a + (b ?? 0), 0);
}

export function reportText(r: MaskReport) {
  return Object.entries(r)
    .map(([k, v]) => `${k} ${v}건`)
    .join(", ");
}

// AI가 만든 링크는 http(s)만 허용 (javascript: 등 차단)
export function safeUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}
