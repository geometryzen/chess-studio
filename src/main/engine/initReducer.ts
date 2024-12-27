import { get } from "lodash";

import { REGEX } from "./const";
import { parseId } from "./parseId";
import { parseOption, UciOption } from "./parseOption";

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
