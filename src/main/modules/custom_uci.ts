"use strict";

import { app } from "electron";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "querystring";

const scripts_dir = "scripts";
const example_file = "example.txt";

const example = `setoption name Something value WhoKnows
setoption name Example value Whatever`;

// To avoid using "remote", we rely on the main process passing userData location in the query...

export const script_dir_path = app ? join(app.getPath("userData"), scripts_dir) : join(parse(global.location.search.slice(1))["user_data_path"] as string, scripts_dir);

export const load = () => {
    try {
        let files = readdirSync(script_dir_path);

        let ret = [];

        for (let file of files) {
            ret.push({
                name: file,
                path: join(script_dir_path, file)
            });
        }

        return ret;
    } catch (err) {
        return [
            {
                name: example_file,
                path: join(script_dir_path, example_file)
            }
        ];
    }
};

export const create_if_needed = () => {
    // Note that this must be called fairly late, when userData directory exists.

    try {
        if (!existsSync(script_dir_path)) {
            mkdirSync(script_dir_path);
            let example_path = join(script_dir_path, example_file);
            writeFileSync(example_path, example);
        }
    } catch (err) {
        console.log(`${err}`);
    }
};
