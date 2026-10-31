import { capEval, formatEval } from "@/lib/coach";

/** Vertical eval bar. cp is White POV. */
export function EvalBar({ cp, mate, orientation }: { cp: number; mate: number | null; orientation: "white" | "black" }) {
  const v = mate !== null ? (mate > 0 ? 1000 : -1000) : capEval(cp);
  // Map ±1000cp through a soft curve to 0..100% white share.
  const white = 50 + 50 * (2 / (1 + Math.exp(-v / 250)) - 1);
  const flip = orientation === "black";
  return (
    <div className="relative w-3 shrink-0 overflow-hidden rounded-full bg-eval-black sm:w-4" aria-label={`Evaluation ${formatEval(cp, mate)}`}>
      <div
        className="absolute inset-x-0 bg-eval-white transition-all duration-500"
        style={flip ? { top: 0, height: `${white}%` } : { bottom: 0, height: `${white}%` }}
      />
      <span className="absolute inset-x-0 top-1/2 h-px bg-muted-foreground/40" />
    </div>
  );
}
