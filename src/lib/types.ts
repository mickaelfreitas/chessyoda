import type { MoveLabel, MistakeType } from "./coach";

/** One ply as stored in games.moves. Evals are centipawns from White's POV. */
export type MoveRecord = {
  ply: number;
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  evalBefore: number;
  evalAfter: number;
  mateAfter: number | null;
  bestUci: string;
  bestLine: string[]; // SAN from fenBefore
  replyLine?: string[]; // SAN from fenAfter, coach's best opponent continuation
  hintUsed?: boolean;
  threatAnswer?: boolean;
  skillTags?: import("./skills").SkillTag[];
  label?: MoveLabel; // only for player moves
  mistakeType?: MistakeType;
  byPlayer: boolean;
};
