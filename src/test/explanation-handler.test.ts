import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn(), handler: null as null | ((args: any) => Promise<any>) }));
vi.mock("@tanstack/react-start", () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: any) => { mocks.handler = handler; return handler; } };
  return { createServerFn: () => builder };
});
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => new Request("https://chessyoda.com", { headers: { origin: "https://chessyoda.com" } }) }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
import { DAILY_EXPLANATION_LIMIT } from "@/lib/explain.functions";
const data = { fen: new Chess().fen(), played: "e4", bestLine: ["d4"], rating: 1400 };
describe("server explanation quota", () => {
  beforeEach(() => { vi.stubEnv("ANTHROPIC_API_KEY", "test-only-not-a-credential"); vi.stubGlobal("fetch", mocks.fetch); mocks.rpc.mockReset(); mocks.fetch.mockReset(); });
  it("passes exactly 300 and the verified caller ID to the atomic quota before upstream calls", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    if (!mocks.handler) throw new Error("Missing handler");
    const response = await mocks.handler({ data, context: { userId: "caller-id" } });
    expect(DAILY_EXPLANATION_LIMIT).toBe(300);
    expect(mocks.rpc).toHaveBeenCalledWith("consume_explanation_allowance", { p_user_id: "caller-id", p_limit: 300 });
    expect(response.text).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("fails closed when durable quota storage fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private internal details" } });
    if (!mocks.handler) throw new Error("Missing handler");
    const response = await mocks.handler({ data, context: { userId: "caller-id" } });
    expect(response.text).toBeNull();
    expect(JSON.stringify(response)).not.toContain("private internal details");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});