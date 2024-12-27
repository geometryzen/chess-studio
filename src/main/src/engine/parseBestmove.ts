import { REGEX } from "./const.js";
import { Info } from "./parseInfo.js";

export interface BestMove {
    bestmove: string;
    ponder?: string;
    info?: Info[];
}

export function parseBestmove(line: string) {
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
