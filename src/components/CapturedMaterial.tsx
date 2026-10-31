import type { Color } from "chess.js";
import { CAPTURE_ORDER, materialAt } from "@/lib/game-session";
const glyphs = { w: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" }, b: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" } };
export function CapturedMaterial({ material, side }: { material: ReturnType<typeof materialAt>; side: Color }) {
  return <span className="inline-flex flex-wrap items-center gap-1 text-primary" aria-label={`${side === "w" ? "White" : "Black"} captured material`}>
    {CAPTURE_ORDER.map((type) => {
      const count = material.captured[side].filter((piece) => piece === type).length;
      return count ? <span key={type} className="text-xl leading-none" title={`${count} captured ${type}`} aria-label={`${count} ${type}`}>{glyphs[side][type].repeat(count)}</span> : null;
    })}
    {material.advantage[side] > 0 && <span className="font-mono text-sm">+{material.advantage[side]}</span>}
  </span>;
}