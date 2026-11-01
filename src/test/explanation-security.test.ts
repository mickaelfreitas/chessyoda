import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { allowedExplanationOrigin, validateExplanationInput, EXPLANATION_MODEL, EXPLANATION_MAX_TOKENS } from "@/lib/explanation-security";

const valid = { fen: new Chess().fen(), played: "e4", bestLine: ["d4", "d5"], rating: 1400 };
describe("explanation security", () => {
  it("accepts valid chess inputs", () => expect(validateExplanationInput(valid)).toEqual(valid));
  it("rejects invalid FEN", () => expect(validateExplanationInput({ ...valid, fen: "invalid" })).toBeNull());
  it("rejects illegal played moves", () => expect(validateExplanationInput({ ...valid, played: "e5" })).toBeNull());
  it("rejects illegal engine continuations", () => expect(validateExplanationInput({ ...valid, bestLine: ["e4", "e4"] })).toBeNull());
  it("accepts rating zero", () => expect(validateExplanationInput({ ...valid, rating: 0 })?.rating).toBe(0));
  it("accepts rating 3500", () => expect(validateExplanationInput({ ...valid, rating: 3500 })?.rating).toBe(3500));
  it("rejects ratings outside 0–3500", () => {
    for (const rating of [-1, 3501, 2.5, NaN]) expect(validateExplanationInput({ ...valid, rating })).toBeNull();
  });
  it("rejects oversized values and arrays before chess parsing", () => {
    expect(validateExplanationInput({ ...valid, fen: "x".repeat(121) })).toBeNull();
    expect(validateExplanationInput({ ...valid, played: "x".repeat(13) })).toBeNull();
    expect(validateExplanationInput({ ...valid, bestLine: Array(13).fill("e4") })).toBeNull();
    expect(validateExplanationInput({ ...valid, bestLine: ["x".repeat(13)] })).toBeNull();
  });
  it("uses only the requested model", () => expect(EXPLANATION_MODEL).toBe("claude-haiku-5-5"));
  it("caps generated output at 300 tokens", () => expect(EXPLANATION_MAX_TOKENS).toBe(300));
  it("allows the exact production origin", () => expect(allowedExplanationOrigin("https://chessyoda.com")).toBe(true));
  it("allows the app's www and published domains", () => {
    expect(allowedExplanationOrigin("https://www.chessyoda.com")).toBe(true);
    expect(allowedExplanationOrigin("https://chess-yoda-coach.lovable.app")).toBe(true);
  });
  it("allows only this project's preview", () => {
    expect(allowedExplanationOrigin("https://id-preview--148f2dc3-6131-4c13-b3db-09bd09d28f7d.lovable.app")).toBe(true);
    expect(allowedExplanationOrigin("https://attacker.lovable.app")).toBe(false);
  });
  it("rejects missing, malicious, and production localhost origins", () => {
    for (const origin of [null, "https://evil.test", "https://chessyoda.com.evil.test", "http://localhost:8080"]) expect(allowedExplanationOrigin(origin)).toBe(false);
    expect(allowedExplanationOrigin("http://localhost:8080", true)).toBe(true);
  });
});