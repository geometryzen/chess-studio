import { existsSync, readFileSync, writeFileSync } from "fs";
// import { join } from "path";

export const filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

//export const filepath = app
//    ? join(app.getPath("userData"), filename) // in Main process
//    : join(parse(global.location.search.slice(1))["user_data_path"] as string, filename); // in Renderer process

export interface Config {
    engineFilename?: string;
    engineFolder?: string;
}
export const defaults: Config = {};

export const load = (configPath: string): Config => {

    const cfg: Config = {};

    if (existsSync(configPath)) {
        const raw = readFileSync(configPath, "utf8");
        Object.assign(cfg, JSON.parse(raw));
    }

    return cfg;
};

export const save = (configPath: string, cfg: Config) => {
    writeFileSync(configPath, JSON.stringify(cfg, null, "\t"));
};
