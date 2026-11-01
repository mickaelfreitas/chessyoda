import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handler: null as null | ((args: any) => Promise<any>), rpc: vi.fn(), fetch: vi.fn(), existing: vi.fn(), update: vi.fn(), game: { id: "12345678-1234-1234-1234-123456789012", user_id: "owner", moves: [], pgn: null, result: "0-1", player_color: "white" } }));
vi.mock("@tanstack/react-start", () => {
  const b = { middleware: () => b, inputValidator: () => b, handler: (h: any) => { mocks.handler = h; return h; } };
  return { createServerFn: () => b };
});
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => new Request("https://chessyoda.com", { headers: { origin: "https://chessyoda.com" } }) }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc, from: () => { const b: any = { select: () => b, update: mocks.update, eq: () => b, single: async () => ({ data: { claim_token: "lease" } }) }; mocks.update.mockReturnValue(b); return b; } } }));
import "@/lib/learnings.functions";
function context() { return { userId: "owner", supabase: { from: (table: string) => { const b: any = { select: () => b, eq: () => b, single: async () => ({ data: mocks.game, error: null }), maybeSingle: table === "game_learnings" ? mocks.existing : async () => ({ data: { rating: 1400 } }) }; return b; } } }; }
describe("secured game learnings", () => {
  beforeEach(() => { vi.stubEnv("ANTHROPIC_API_KEY", "test-only-not-a-credential"); vi.stubGlobal("fetch", mocks.fetch); mocks.fetch.mockReset(); mocks.rpc.mockReset(); mocks.existing.mockResolvedValue({ data: null }); });
  it("uses 500 tokens, thinking off, a per-game claim, and never consumes Why allowance", async () => {
    mocks.rpc.mockResolvedValue({ data: true }); mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "- Practice checking threats." }], stop_reason: "end_turn" }), { status: 200 }));
    if (!mocks.handler) throw new Error("Missing handler");
    const result = await mocks.handler({ data: { gameId: mocks.game.id }, context: context() });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("claim_game_learnings", { p_game_id: mocks.game.id, p_user_id: "owner" });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 500, thinking: { type: "disabled" } });
    expect(result.text).toBe("- Practice checking threats.");
  });
  it("returns stored learnings without a second generation", async () => {
    mocks.existing.mockResolvedValue({ data: { status: "completed", content: "Stored" } });
    if (!mocks.handler) throw new Error("Missing handler");
    expect((await mocks.handler({ data: { gameId: mocks.game.id }, context: context() })).text).toBe("Stored"); expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});