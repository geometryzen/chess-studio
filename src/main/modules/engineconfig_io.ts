"use strict";

import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "querystring";

import { debork_json } from "./debork_json.js";

export const filename = "engines.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

export const filepath = app
    ? join(app.getPath("userData"), filename) // in Main process
    : join(parse(global.location.search.slice(1))["user_data_path"] as string, filename); // in Renderer process

export class EngineConfig {
    "args": unknown[] = [];
    "options": Record<string, unknown> = {};
    "search_nodes": null;
    "search_nodes_special": number = 10000;
    "limit_by_time": boolean = false;
}

// ---------------------------------------------------------------------------------------------------------------------------

function fix(cfg: any) {
    // The nameless dummy that hub creates at startup needs an entry...

    cfg[""] = newentry();

    // Fix any saved entries present in the file...

    for (let key of Object.keys(cfg)) {
        if (typeof cfg[key] !== "object" || cfg[key] === null) {
            cfg[key] = newentry();
        }
        if (Array.isArray(cfg[key].args) === false) {
            cfg[key].args = [];
        }
        if (typeof cfg[key].options !== "object" || cfg[key].options === null) {
            cfg[key].options = {};
        }
        if (typeof cfg[key].limit_by_time !== "boolean") {
            cfg[key].limit_by_time = cfg[key].limit_by_time ? true : false;
        }

        // We don't really care about missing search_nodes and search_nodes_special properties. (?)
    }
}

const newentry = () => {
    return new EngineConfig();
};

export const load = (): [string | null, EngineConfig] => {
    let cfg = new EngineConfig();

    let err_to_return: string | null = null;

    try {
        if (existsSync(filepath)) {
            let raw = readFileSync(filepath, "utf8");
            try {
                Object.assign(cfg, JSON.parse(raw));
            } catch (err) {
                Object.assign(cfg, JSON.parse(debork_json(raw)));
            }
        }
    } catch (err) {
        err_to_return = `${err}`;
    }

    fix(cfg);
    return [err_to_return, cfg];
};

export const save = (cfg: EngineConfig) => {
    if (cfg instanceof EngineConfig === false) {
        throw "Wrong type of object sent to engineconfig_io.save()";
    }

    const cfx = cfg as unknown as Record<string, unknown>;

    let blank = cfx[""];
    delete cfx[""];

    writeFileSync(filepath, JSON.stringify(cfg, null, "\t"));

    cfx[""] = blank;
};

export const create_if_needed = (cfg: EngineConfig) => {
    // Note that this must be called fairly late, when userData directory exists.

    if (cfg instanceof EngineConfig === false) {
        throw "Wrong type of object sent to engineconfig_io.create_if_needed()";
    }

    if (existsSync(filepath)) {
        return;
    }

    save(cfg);
};
