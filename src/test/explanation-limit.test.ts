import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => {
  const builder = {
    middleware: () => builder,
    inputValidator: () => builder,
    handler: () => vi.fn(),
  };
  return { createServerFn: () => builder };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { DAILY_EXPLANATION_LIMIT } from "@/lib/explain.functions";

describe("daily explanation allowance", () => {
  it("stores the requested 300 explanations per user per day", () => {
    expect(DAILY_EXPLANATION_LIMIT).toBe(300);
  });
});