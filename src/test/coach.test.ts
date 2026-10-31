import { describe, expect, it } from "vitest";
import { classifyMove, evalLoss, hangingPieces, SAFETY_NET_THRESHOLD } from "@/lib/coach";
import { eloToEngineSettings } from "@/lib/engine";

describe("coach rules", () => {
  it("safety net triggers above a 2-pawn drop", () => {
    expect(SAFETY_NET_THRESHOLD).toBe(200);
    expect(evalLoss(50, -200, "w")).toBe(250);
    expect(evalLoss(-50, 200, "b")).toBe(250);
  });

  it("labels moves by eval change", () => {
    expect(classifyMove(0, true)).toBe("best");
    expect(classifyMove(40, false)).toBe("good");
    expect(classifyMove(90, false)).toBe("inaccuracy");
    expect(classifyMove(180, false)).toBe("mistake");
    expect(classifyMove(350, false)).toBe("blunder");
  });

  it("detects an undefended attacked piece", () => {
    // White knight on e5 attacked by black pawn d6, undefended.
    expect(hangingPieces("4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1", "w")).toContain("e5");
  });

  it("maps opponent strength 800–2400 to engine settings", () => {
    expect(eloToEngineSettings(800).skill).toBe(0);
    expect(eloToEngineSettings(2400).skill).toBe(20);
  });
});
