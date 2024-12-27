import { REGEX } from "./const";

export interface UciOption {
    type: "check" | "spin" | "combo" | "button" | "string";
    default?: boolean | number | string;
    min?: number;
    max?: number;
    options?: string[];
}

export function parseOption(line: string): { [name: string]: UciOption } | null {
    const parsed = REGEX.option.exec(line);
    if (!parsed) return null;

    console.log(`parsed[2] => ${parsed[2]}`);

    const option: UciOption = {
        type: parsed[2] as "check" | "spin" | "combo" | "button" | "string"
    };

    switch (parsed[2]) {
        case "check":
            option.default = parsed[3] === "true";
            break;
        case "spin":
            option.default = parseInt(parsed[3]);
            option.min = parseInt(parsed[4]);
            option.max = parseInt(parsed[5]);
            break;
        case "combo":
            option.default = parsed[3];
            option.options = parsed[6].split(/ ?var ?/g);
            break; //combo breaker?
        case "string":
            option.default = parsed[3];
            break;
        case "button":
            //no other info
            break;
    }

    return {
        [parsed[1]]: option
    };
}
