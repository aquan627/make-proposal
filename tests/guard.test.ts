// SER-009~012 · 요청 검증과 호출 제한
import { describe, expect, it } from "vitest";
import { GuardError, rateLimit, readJson } from "@/lib/guard";
import { jsonRequest } from "./helpers";

describe("SER-011 요청 위조 차단", () => {
  it("JSON이 아니면 415", async () => {
    await expect(readJson(jsonRequest("/x", "a=b", { contentType: "application/x-www-form-urlencoded" }), 1000)).rejects.toMatchObject({ status: 415 });
  });
  it("다른 출처(Origin)면 403", async () => {
    await expect(readJson(jsonRequest("/x", {}, { origin: "https://evil.example" }), 1000)).rejects.toMatchObject({ status: 403 });
  });
  it("같은 출처는 통과", async () => {
    await expect(readJson(jsonRequest("/x", { a: 1 }, { origin: "https://rfp.test" }), 1000)).resolves.toEqual({ a: 1 });
  });
});

describe("SER-012 입력 크기 제한", () => {
  it("한도를 넘으면 413", async () => {
    await expect(readJson(jsonRequest("/x", { t: "x".repeat(2000) }), 1000)).rejects.toBeInstanceOf(GuardError);
  });
});

describe("SER-009/010 호출 횟수 제한", () => {
  it("창 안에서 한도를 넘으면 거절한다", () => {
    const key = "test:" + Math.random();
    const results = Array.from({ length: 4 }, () => rateLimit(key, 3, 60_000));
    expect(results).toEqual([true, true, true, false]);
  });
});
