// SER-001, SER-013 · 개인정보 마스킹과 링크 검증
import { describe, expect, it } from "vitest";
import { maskDeep, maskPII, reportTotal, safeUrl } from "@/lib/pii";

describe("SER-001 개인정보 마스킹: 가려야 하는 값", () => {
  const cases: [string, string, string][] = [
    ["주민·외국인등록번호", "주민번호 900101-1234567", "[주민번호 마스킹]"],
    ["여권번호", "여권 M12345678 제출", "[여권번호 마스킹]"],
    ["운전면허번호", "면허 11-22-333333-44", "[면허번호 마스킹]"],
    ["카드번호", "카드 4111 1111 1111 1111", "[카드번호 마스킹]"],
    ["전화번호", "연락처 010-1234-5678", "[전화번호 마스킹]"],
    ["전화번호", "대표 02-1234-5678", "[전화번호 마스킹]"],
    ["이메일", "메일 pm@bank.example.com", "[이메일 마스킹]"],
    ["사업자등록번호", "사업자 123-45-67890", "[사업자번호 마스킹]"],
    ["계좌번호", "계좌 110-123-456789", "[계좌번호 마스킹]"],
    ["IP주소", "서버 10.20.30.40", "[IP 마스킹]"],
    ["성명", "담당자: 홍길동", "[성명 마스킹]"],
    ["성명", "김철수 과장 확인", "[성명 마스킹]"],
  ];
  it.each(cases)("%s", (type, input, token) => {
    const r = maskPII(input);
    expect(r.text).toContain(token);
    expect(r.report[type as keyof typeof r.report]).toBeGreaterThan(0);
  });

  it("Luhn 검증에 실패한 16자리 숫자는 카드번호로 보지 않는다", () => {
    expect(maskPII("번호 1234 5678 9012 3456").report["카드번호"]).toBeUndefined();
  });
});

describe("SER-001 개인정보 마스킹: 보존해야 하는 값", () => {
  const keep = ["2026-10-23", "85억원", "3,000 TPS", "SFR-001", "PER-001", "99.99%", "14개월", "1588-1234", "디지털금융본부 팀장 회의"];
  it.each(keep)("%s 는 그대로 둔다", (v) => {
    const r = maskPII(`내용: ${v}`);
    expect(r.text).toContain(v);
    expect(reportTotal(r.report)).toBe(0);
  });

  it("이미 마스킹된 토큰은 다시 바꾸지 않는다", () => {
    const once = maskPII("010-1234-5678").text;
    expect(maskPII(once).text).toBe(once);
  });
});

describe("SER-002 객체 전체 마스킹 (2·3단계 입력)", () => {
  it("중첩된 객체·배열의 문자열을 모두 마스킹하고 건수를 합산한다", () => {
    const report = {};
    const out = maskDeep({ a: "010-1111-2222", b: [{ c: "pm@x.example.com" }], n: 3 }, report);
    expect(JSON.stringify(out)).not.toMatch(/010-1111-2222|pm@x/);
    expect(out.n).toBe(3);
    expect(reportTotal(report)).toBe(2);
  });
});

describe("SER-013 링크 검증", () => {
  it.each([["javascript:alert(1)", ""], ["data:text/html,x", ""], ["not a url", ""], [undefined, ""], ["https://ok.example.com/a", "https://ok.example.com/a"], ["http://ok.example.com", "http://ok.example.com/"]])("%s", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });
});
