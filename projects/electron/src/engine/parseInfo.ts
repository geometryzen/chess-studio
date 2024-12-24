import forEach from "lodash/forEach";
import isEmpty from "lodash/isEmpty";

import { INFO_NUMBER_TYPES, REGEX } from "./const";

export type Info = Record<string, { unit: string; value: number } | number | string>;

export function parseInfo(line: string) {
    const info: Info = {};
    forEach(REGEX.info, (val, key) => {
        const parsed = val.exec(line);
        if (!parsed) return;
        switch (key) {
            case "score":
                info[key] = {
                    unit: parsed[1],
                    value: parseFloat(parsed[2])
                };
                break;
            default:
                if (INFO_NUMBER_TYPES.includes(key)) {
                    info[key] = parseFloat(parsed[1]);
                } else {
                    info[key] = parsed[1];
                }
        }
    });
    if (isEmpty(info)) {
        return;
    }
    return info;
}
