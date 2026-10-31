import { Chess } from "chess.js";
import { cn } from "@/lib/utils";

const position = new Chess("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3").board();
const glyphs = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export function LandingBoard({ highlighted }: { highlighted: boolean }) {
  return <div className="landing-board" role="img" aria-label="White queen on h5 and bishop on c4 threaten f7; Black to move">
    {position.flat().map((piece, i) => {
      const square = `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)}`;
      return <div key={square} data-square={square} className={cn("landing-square", (Math.floor(i / 8) + i % 8) % 2 === 0 ? "square-light" : "square-dark", piece?.color === "w" ? "piece-white" : "piece-black", highlighted && square === "f7" && "square-target", highlighted && ["h5", "c4"].includes(square) && "square-source")}>
        {piece ? glyphs[piece.type] : ""}
      </div>;
    })}
  </div>;
}