import { LABEL_TEXT, type MoveLabel } from "@/lib/coach";
import { cn } from "@/lib/utils";

const styles: Record<MoveLabel, string> = {
  best: "bg-best text-primary-foreground",
  good: "bg-good text-primary-foreground",
  inaccuracy: "bg-inaccuracy text-accent-foreground",
  mistake: "bg-mistake text-primary-foreground",
  blunder: "bg-blunder text-primary-foreground",
};

export const labelText: Record<MoveLabel, string> = {
  best: "text-best",
  good: "text-good",
  inaccuracy: "text-inaccuracy",
  mistake: "text-mistake",
  blunder: "text-blunder",
};

export function MoveLabelBadge({ label, className }: { label: MoveLabel; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[label], className)}>
      {LABEL_TEXT[label]}
    </span>
  );
}
