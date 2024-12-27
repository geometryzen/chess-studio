import { get } from "lodash";

import { REGEX } from "./const";
import { BestMove, parseBestmove } from "./parseBestmove";
import { parseInfo } from "./parseInfo";

export function goReducer(result: BestMove, line: string): BestMove {
    const cmdType = get(REGEX.cmdType.exec(line), 1);
    switch (cmdType) {
        case "bestmove": {
            const best = parseBestmove(line);
            if (best) {
                if (best.bestmove) {
                    result.bestmove = best.bestmove;
                }
                if (best.ponder) {
                    result.ponder = best.ponder;
                }
            }
            break;
        }
        case "info": {
            const info = parseInfo(line);
            if (info) {
                if (result.info) {
                    result.info.push(info);
                }
            }
            break;
        }
    }
    return result;
}
