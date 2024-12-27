import get from "lodash/get.js";

import { REGEX } from "./const.js";
import { parseId } from "./parseId.js";
import { parseOption, UciOption } from "./parseOption.js";

export interface InitResult {
    id: { name: string; author: string };
    options: Record<string, UciOption>;
}
export function initReducer(result: InitResult, line: string) {
    console.log(`line => ${line}`);
    const cmdType = get(REGEX.cmdType.exec(line), 1);
    console.log(`cmdType => "${cmdType}"`);
    switch (cmdType) {
        case "id":
            result.id = {
                ...result.id,
                ...parseId(line)
            };
            break;
        case "option":
            result.options = {
                ...result.options,
                ...parseOption(line)
            };
            break;
    }
    return result;
}
