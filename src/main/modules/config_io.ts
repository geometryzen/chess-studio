import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "querystring";

export const filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

export const filepath = app
    ? join(app.getPath("userData"), filename) // in Main process
    : join(parse(global.location.search.slice(1))["user_data_path"] as string, filename); // in Renderer process

export class Config {
    "warning": "Editing this file while ChessStudio is running will generally cause your edits to be lost.";
    "path": string | null; // Not undefined, all normal keys should have an actual value.

    "args_unused": null;
    "options_unused": null;

    "disable_hw_accel": false;

    behaviour: "halt" = "halt";
    flip: boolean = false;
    "width": 1280;
    "height": 835;
    board_size: number = 640;
    square_size: number = 80;
    info_font_size: 16 | 18 | 20 | 24 | 28 | 32 = 16;
    "pgn_font_size": 16 | 18 | 20 | 24 | 28 | 32 = 16;
    "fen_font_size": 16;
    "arrow_width": 8;
    "arrowhead_radius": 12;
    "board_font": "18px Arial";

    graph_height: 0 | 32 | 48 | 64 | 96 | 128 | 160 | 192 = 96;
    graph_line_width: 2 | 3 | 4 | 5 | 6 | 7 | 8 = 2;
    "graph_minimum_length": 41; // Desired depth + 1

    "light_square": "#dadada";
    "dark_square": "#b4b4b4";
    "active_square": "#66aaaa";
    "move_squares_with_alpha": "#ffff0026";

    "best_colour": "#66aaaa";
    "good_colour": "#66aa66";
    "bad_colour": "#cccc66";
    "terrible_colour": "#cc6666";
    "actual_move_colour": "#cc9966";

    "searchmoves_buttons": true;
    "focus_on_text": "focused:";
    "focus_off_text": "focus?";

    "accept_bounds": false;
    "max_info_lines": null; // Hidden option

    "bad_move_threshold": 0.02;
    "terrible_move_threshold": 0.04;
    ab_filter_threshold: number = 0.1;

    "arrow_filter_type": "N" | "U" | "all" | "top" = "N";
    "arrow_filter_value": number = 0.01;

    "arrows_enabled": true;
    "click_spotlight": true;
    "next_move_arrow": false;
    "next_move_outline": false;
    "next_move_unique_colour": false;
    arrowhead_type: 0 | 1 | 2 | 3 | 4 = 0;

    "ev_pov": "w" | "b" | null = null;
    "cp_pov": "w" | "b" | null = null;
    "wdl_pov": "w" | "b" | null = null;

    "show_cp": false;
    "show_n": true;
    "show_n_abs": true;
    "show_depth": true;
    "show_p": true;
    "show_v": false;
    "show_q": false;
    "show_u": false;
    "show_s": false;
    "show_m": false;
    "show_wdl": true;
    "infobox_stats_newline": false;
    "infobox_pv_move_numbers": false;
    "hover_draw": false;
    hover_method: 0 | 1 | 2 = 2;

    "looker_api": null;
    "look_past_25": false;

    pv_click_event: 0 | 1 | 2 = 1; // 0: nothing, 1: goto, 2: tree

    "pgn_ev": true;
    "pgn_cp": false;
    "pgn_n": true;
    "pgn_n_abs": false;
    "pgn_of_n": true;
    "pgn_depth": false;
    "pgn_p": false;
    "pgn_v": false;
    "pgn_q": false;
    "pgn_u": false;
    "pgn_s": false;
    "pgn_m": false;
    "pgn_wdl": false;

    pgn_dialog_folder: string = "";
    engine_dialog_folder: string = "";
    weights_dialog_folder: string = "";
    evalfile_dialog_folder: string = "";
    syzygy_dialog_folder: string = "";
    "pieces_dialog_folder": string = "";
    background_dialog_folder: string = "";
    book_dialog_folder: string = "";

    update_delay: 25 | 60 | 125 | 170 | 250 = 170;
    "animate_delay_multiplier": number = 4;

    "allow_arbitrary_scripts": false;
    "ignore_filesize_limits": false;
    "allow_stopped_analysis": false;
    "never_suppress_searchmoves": true;
    "never_grayout_infolines": false;
    "suppress_ucinewgame": false;

    "show_engine_state": false;

    book_depth: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 = 10;

    save_enabled: boolean = false;
    "override_piece_directory": null;
    "override_board": null;

    "leelaish_names": string[] = ["Lc0", "Leela", "Ceres"]; // If this gets updated, will need to fix old config files.

    "logfile": null;
    "clear_log": true;
    "logfile_timestamp": false;
    "log_info_lines": false;
    "log_useless_info": false;
    "log_illegal_moves": true;
    "log_positions": true;
    uncertainty_cutoff: unknown;
    book_explorer: boolean = false;
    lichess_explorer: boolean = false;
}

export const defaults = new Config();

function fix(cfg: Config) {
    // We want to create a few temporary things (not saved to file)...

    cfg.flip = false;
    cfg.behaviour = "halt";
    cfg.square_size = Math.floor(cfg.board_size / 8);

    // Make sure objectish things at least exist...

    if (Array.isArray(cfg.leelaish_names) === false) {
        cfg.leelaish_names = Array.from(defaults.leelaish_names);
    }

    // Fix the board size...

    cfg.board_size = cfg.square_size * 8;

    // The uncertainty_cutoff key was removed. Filtering by U was also removed...

    if (cfg.uncertainty_cutoff !== undefined || cfg.arrow_filter_type === "U") {
        cfg.arrow_filter_type = "N";
        cfg.arrow_filter_value = defaults.arrow_filter_value;
    }

    // This can't be 0 because we divide by it...

    cfg.animate_delay_multiplier = Math.floor(cfg.animate_delay_multiplier);

    if (cfg.animate_delay_multiplier <= 0) {
        cfg.animate_delay_multiplier = 1;
    }

    // We used to expect font sizes to be strings with "px"...
    const cfx = cfg as unknown as Record<string, unknown>;

    for (let key of ["info_font_size", "pgn_font_size", "fen_font_size"]) {
        if (typeof cfx[key] === "string") {
            cfx[key] = parseInt(cfx[key], 10); // Works even if string ends with "px"
            if (Number.isNaN(cfx[key])) {
                cfx[key] = (defaults as unknown as Record<string, unknown>)[key];
            }
        }
    }

    // Convert any strings of "false", "true" and "null"...

    for (let key of Object.keys(cfg)) {
        if (typeof cfx[key] === "string") {
            if (cfx[key].toLowerCase() === "true") {
                cfx[key] = true;
            } else if (cfx[key].toLowerCase() === "false") {
                cfx[key] = false;
            } else if (cfx[key].toLowerCase() === "null") {
                cfx[key] = null;
            }
        }
    }

    // These things need to be strings. They are used as defaultPath parameters
    // but versions of Electron >= 6 (I think) crash when they aren't strings.
    // Sadly we defaulted them to null in 1.2.1 so bad config files may exist.

    if (typeof cfg.pgn_dialog_folder !== "string") {
        cfg.pgn_dialog_folder = "";
    }
    if (typeof cfg.engine_dialog_folder !== "string") {
        cfg.engine_dialog_folder = "";
    }
    if (typeof cfg.weights_dialog_folder !== "string") {
        cfg.weights_dialog_folder = "";
    }

    // Too many people are setting this...

    cfg.show_engine_state = defaults.show_engine_state;
}

export const load = (): Config => {
    let cfg = new Config();

    if (existsSync(filepath)) {
        let raw = readFileSync(filepath, "utf8");
        Object.assign(cfg, JSON.parse(raw));
    }

    // Copy default values for any missing keys into the config...
    // We use a copy so that any objects that are assigned are not the default objects.

    let defaults_copy = JSON.parse(JSON.stringify(defaults));

    for (let key of Object.keys(defaults_copy)) {
        if (cfg.hasOwnProperty(key) === false) {
            (cfg as unknown as Record<string, unknown>)[key] = defaults_copy[key];
        }
    }

    fix(cfg);

    return cfg;
};

export const save = (cfg: Config) => {
    if (cfg instanceof Config === false) {
        throw "Wrong type of object sent to config_io.save()";
    }

    // Make a copy of the defaults. Doing it this way seems to
    // ensure the final JSON string has the same ordering...

    let out = JSON.parse(JSON.stringify(defaults));

    // Adjust that copy, but only for keys present in both.

    for (let key of Object.keys(cfg)) {
        if (out.hasOwnProperty(key)) {
            out[key] = (cfg as unknown as Record<string, unknown>)[key];
        }
    }

    writeFileSync(filepath, JSON.stringify(out, null, "\t"));
};

export const create_if_needed = (cfg: Config) => {
    // Note that this must be called fairly late, when userData directory exists.

    if (cfg instanceof Config === false) {
        throw "Wrong type of object sent to config_io.create_if_needed()";
    }

    if (existsSync(filepath)) {
        return;
    }

    save(cfg);
};
