import { Chessboard, type ChessboardOptions } from "react-chessboard";

/** Themed wrapper around react-chessboard. */
export function Board(props: ChessboardOptions) {
  return (
    <div className="aspect-square w-full overflow-hidden border border-border">
      <Chessboard
        options={{
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          animationDurationInMs: 180,
          allowDrawingArrows: true,
          ...props,
        }}
      />
    </div>
  );
}

export const sq = {
  threat: { backgroundColor: "var(--highlight-threat)" },
  key: { backgroundColor: "var(--highlight-key)" },
  last: { backgroundColor: "var(--highlight-last)" },
};
export const ARROW_BEST = "var(--arrow-best)";
