import { REGEX } from "./const";
import { Info } from "./parseInfo";

export interface BestMove {
    bestmove: string | null;
    ponder?: string;
    info?: Info[];
}

export function parseBestmove(line: string): BestMove | undefined {
    const bestmove = REGEX.bestmove.exec(line);
    if (!bestmove || !bestmove[1]) return;
    const parsed: BestMove = {
        bestmove: bestmove[1]
    };
    if (bestmove[2]) {
        parsed.ponder = bestmove[2];
    }
    return parsed;
}
