/**
 * Copyright (c) 2019, Chris Oakman
 * Copyright (c) 2019, Justin Fagnani
 * Released under the MIT license
 * https://github.com/justinfagnani/chessboard-element/blob/master/LICENSE.md
 */

const RUN_ASSERTS = true;

export const isString = (s: unknown): s is string => {
    return typeof s === "string";
};

export const isFunction = (f: unknown): f is Function => {
    return typeof f === "function";
};

export const isInteger = (n: unknown): n is number => {
    return typeof n === "number" && isFinite(n) && Math.floor(n) === n;
};

/**
 * An expensive copy of an object using the JSON stringify and parse functions.
 */
export const deepCopy = <T>(thing: T): T => {
    return JSON.parse(JSON.stringify(thing));
};

export const interpolateTemplate = (str: string, obj: object): string => {
    for (const [key, value] of Object.entries(obj)) {
        const keyTemplateStr = "{" + key + "}";
        while (str.includes(keyTemplateStr)) {
            str = str.replace(keyTemplateStr, value);
        }
    }
    return str;
};

if (RUN_ASSERTS) {
    console.assert(interpolateTemplate("abc", { a: "x" }) === "abc");
    console.assert(interpolateTemplate("{a}bc", {}) === "{a}bc");
    console.assert(interpolateTemplate("{a}bc", { p: "q" }) === "{a}bc");
    console.assert(interpolateTemplate("{a}bc", { a: "x" }) === "xbc");
    console.assert(interpolateTemplate("{a}bc{a}bc", { a: "x" }) === "xbcxbc");
    console.assert(interpolateTemplate("{a}{a}{b}", { a: "x", b: "y" }) === "xxy");
}
