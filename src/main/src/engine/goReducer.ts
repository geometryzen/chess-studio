import get from "lodash/get.js";

import { REGEX } from "./const.js";
import { BestMove, parseBestmove } from "./parseBestmove.js";
import { Info, parseInfo } from "./parseInfo.js";

export function goReducer(result: BestMove, line: string): BestMove {
    const cmdType = get(REGEX.cmdType.exec(line), 1);
    switch (cmdType) {
        case "bestmove": {
            const best = parseBestmove(line);
            if (best.bestmove) result.bestmove = best.bestmove;
            if (best.ponder) result.ponder = best.ponder;
            break;
        }
        case "info": {
            const info: Info = parseInfo(line);
            if (info) {
                result.info.push(info);
            }
            break;
        }
    }
    return result;
}
