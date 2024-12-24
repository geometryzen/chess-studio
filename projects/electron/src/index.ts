import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, screen, shell } from "electron";
import installExtension from "electron-devtools-installer";
import path from "path";
import url from "url";
import { alert } from "./modules/alert_main.js";
import { Config, filename as configFilename, filepath as configFilepath, load } from "./modules/config_io.js";
import { load as loadCustomUCI, script_dir_path } from "./modules/custom_uci.js";
import { filename as engineFilename, filepath as engineFilepath } from "./modules/engineconfig_io.js";
import { about_custom_pieces, about_hashes, about_sizes, about_versus_mode, adding_scripts, save_not_enabled, thread_warning, wrong_engine_exe } from "./modules/messages.js";
import { running_as_electron } from "./modules/running_as_electron.js";
import { stringify } from "./modules/stringify.js";

let config: Config = load()[1];

// The docs are a bit vague but it seems there's a limited timeframe
// in which command line flags can be passed, so do this ASAP...

app.commandLine.appendSwitch("js-flags", "--expose_gc");

let actually_disabled_hw_accel = false;

if (config.disable_hw_accel) {
    try {
        app.disableHardwareAcceleration();
        actually_disabled_hw_accel = true;
        console.log("Hardware acceleration for ChessStudio (GUI, not engine) disabled by config setting.");
    } catch (err) {
        console.log("Failed to disable hardware acceleration.");
    }
}
// We want sync save and open dialogs. In Electron 5 we could get these by calling
// showSaveDialog or showOpenDialog without a callback, but in Electron 6 this no
// longer works and we must call new functions. So find out if they exist...

const save_dialog = dialog.showSaveDialogSync || dialog.showSaveDialog;
const open_dialog = dialog.showOpenDialogSync || dialog.showOpenDialog;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
    app.quit();
}

let menu: Menu;
let menu_is_set = false;

let have_sent_quit = false;
let have_received_terminate = false;

let loaded_engine = "";
let loaded_weights = "";
let loaded_evalfile = "";

let have_warned_hw_accel_setting = false;

const createWindow = (): void => {
    let desired_zoomfactor = 1 / screen.getPrimaryDisplay().scaleFactor;

    let win = new BrowserWindow({
        height: 600,
        width: 800,
        // backgroundColor: "#000000",
        resizable: true,
        show: false,
        useContentSize: true,
        webPreferences: {
            backgroundThrottling: false,
            // contextBridge API in preload.ts can only be used when contextIsolation is enabled.
            // contextIsolation: false,
            nodeIntegration: true,
            spellcheck: false,
            preload: path.join(__dirname, "preload.js"),
            zoomFactor: desired_zoomfactor // Unreliable, see https://github.com/electron/electron/issues/10572
        }
    });

    win.once("ready-to-show", () => {
        try {
            win.webContents.setZoomFactor(desired_zoomfactor); // This seems to work, note issue 10572 above.
        } catch (err) {
            win.webContents.zoomFactor = desired_zoomfactor; // The method above "will be removed" in future.
        }
        win.show();
        win.focus();
    });

    const packagedStartURL = url.format({
        pathname: path.join(__dirname, "chessstudio", "index.html"),
        protocol: "file:",
        slashes: true
    });

    const startURL = app.isPackaged ? packagedStartURL : `http://localhost:4200`;

    win.loadURL(startURL);

    win.webContents.openDevTools();

    win.on("closed", function () {
        win = null;
    });

    app.on("activate", () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            return;
        }
        if (win === null) {
            createWindow();
            return;
        }
    });

    ipcMain.once("renderer_ready", () => {
        if (actually_disabled_hw_accel) {
            win.webContents.send("call", {
                fn: "console",
                args: ["Hardware acceleration is disabled."]
            });
        }

        // Open a file via command line. We must wait until the renderer has properly loaded before we do this.
        // While it might seem like we could do this after "ready-to-show" I'm not 100% sure that the renderer
        // will have fully loaded when that fires.

        let filename = "";

        if (running_as_electron()) {
            if (process.argv.length > 2) {
                filename = process.argv[process.argv.length - 1];
            }
        } else {
            if (process.argv.length > 1) {
                filename = process.argv[process.argv.length - 1];
            }
        }

        if (filename !== "") {
            win.webContents.send("call", {
                fn: "open",
                args: [filename]
            });
        }
    });

    // TODO: Does the handler need to be async?
    ipcMain.handle("bazzo", (event, arg0, arg1) => {
        console.log(`bazzo! ${arg0} ${arg1}`);
        return 42;
    });

    ipcMain.on("alert", (event, msg) => {
        alert(win, msg);
    });

    ipcMain.on("set_title", (event, msg) => {
        win.setTitle(msg);
    });

    ipcMain.on("ack_engine", (event, msg) => {
        loaded_engine = msg;
        set_one_check(msg ? true : false, menu, "Engine", "Choose engine...");
    });

    ipcMain.on("ack_logfile", (event, msg) => {
        set_one_check(msg ? true : false, menu, "Dev", "Logging", "Use logfile...");
    });

    ipcMain.on("ack_book", (event, msg) => {
        set_one_check(msg === "polyglot", menu, "Play", "Use Polyglot book...");
        set_one_check(msg === "pgn", menu, "Play", "Use PGN book...");
    });

    ipcMain.on("ack_node_limit", (event, msg) => {
        set_checks(menu, "Engine", "Limit - normal", msg);
    });

    ipcMain.on("ack_special_node_limit", (event, msg) => {
        set_checks(menu, "Engine", "Limit - auto-eval / play", msg);
    });

    ipcMain.on("ack_limit_by_time", (event, msg) => {
        set_one_check(msg ? true : false, menu, "Engine", "Limit by time instead of nodes");
    });

    ipcMain.on("ack_setoption", (event, msg) => {
        // These are received whenever the renderer actually sends a setoption UCI command.
        // But we also sometimes query some option and get a response indicating what the
        // last value we sent was, or "" if not applicable.

        // Expect msg.key to be a lowercase string
        // Expect msg.val to be a string, possibly "" (can use the fact that "" is false-ish)

        // REMEMBER TO UPDATE engine.js GUI_WANTS_TO_KNOW const WHEN THINGS ARE ADDED...

        switch (msg.key) {
            case "weightsfile":
                loaded_weights = msg.val;
                set_one_check(msg.val ? true : false, menu, "Engine", "Weights", "Lc0 WeightsFile...");
                break;

            case "evalfile":
                loaded_evalfile = msg.val;
                set_one_check(msg.val ? true : false, menu, "Engine", "Weights", "Stockfish EvalFile...");
                break;

            case "syzygypath":
                set_one_check(msg.val ? true : false, menu, "Engine", "Choose Syzygy path...");
                break;

            case "backend":
                set_checks(menu, "Engine", "Backend", msg.val);
                break;

            case "threads":
                set_checks(menu, "Engine", "Threads", msg.val);
                break;

            case "hash": {
                let mb = parseInt(msg.val, 10);
                if (Number.isNaN(mb) === false) {
                    let gb = Math.floor(mb / 1024);
                    set_checks(menu, "Engine", "Hash", `${gb} GB`);
                } else {
                    set_checks(menu, "Engine", "Hash", ""); // i.e. clear all
                }
                break;
            }
            case "multipv":
                set_checks(menu, "Engine", "MultiPV", msg.val); // If it's "500" it will clear all.
                break;

            case "temperature": // Sketchy because there are equivalent representations.
                if (msg.val === "0" || msg.val === "0.0") {
                    set_checks(menu, "Play", "Temperature", "0");
                } else if (msg.val === "1" || msg.val === "1.0") {
                    set_checks(menu, "Play", "Temperature", "1.0");
                } else {
                    set_checks(menu, "Play", "Temperature", msg.val);
                }
                break;

            case "tempdecaymoves": // Not so sketchy because it should be a string of an integer.
                set_checks(menu, "Play", "Temp Decay Moves", msg.val === "0" ? "Infinite" : msg.val);
                break;

            case "contemptmode": // All the menu items are different from the UCI values...
                if (msg.val === "white_side_analysis") {
                    set_checks(menu, "Engine", "Contempt Mode", "White analysis");
                } else if (msg.val === "black_side_analysis") {
                    set_checks(menu, "Engine", "Contempt Mode", "Black analysis");
                } else {
                    set_checks(menu, "Engine", "Contempt Mode", msg.val);
                }
                break;

            case "contempt":
                set_checks(menu, "Engine", "Contempt", msg.val);
                break;

            case "wdlcalibrationelo":
                set_checks(menu, "Engine", "WDL Calibration Elo", msg.val === "0" ? "Use default WDL" : msg.val);
                break;

            case "wdlevalobjectivity":
                if (msg.val === "1") {
                    set_checks(menu, "Engine", "WDL Eval Objectivity", "Yes");
                } else if (msg.val === "0") {
                    set_checks(menu, "Engine", "WDL Eval Objectivity", "No");
                } else {
                    set_checks(menu, "Engine", "WDL Eval Objectivity", msg.val);
                }
                break;

            case "scoretype":
                set_checks(menu, "Engine", "Score Type", msg.val);
                break;

            // REMEMBER TO UPDATE engine.js GUI_WANTS_TO_KNOW const WHEN THINGS ARE ADDED...
        }
    });

    menu = menu_build(win);

    Menu.setApplicationMenu(menu);

    menu_is_set = true;
};

app.whenReady().then(() => {
    // Install Angular DevTools
    // https://angular.io/guide/devtools
    installExtension("ienfalfjdbdpebioblfackkekamfmbnh")
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log("An error occurred: ", err));
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
    createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function menu_build(win: BrowserWindow): Menu {
    const million = 1000 * 1000;
    const billion = 1000 * million;

    let scriptlist_in_menu: unknown[] = [];

    let template = [
        {
            label: "File",
            submenu: [
                {
                    label: "About",
                    click: () => {
                        let s = `ChessStudio ${app.getVersion()} in Electron ${process.versions.electron}\n\n`;
                        s += `Engine: ${loaded_engine}\nWeights: ${loaded_weights || loaded_evalfile || "<auto>"}`;
                        alert(win, s);
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "New game",
                    accelerator: "CommandOrControl+N",
                    click: () => {
                        win.webContents.send("call", "new_game");
                    }
                },
                {
                    label: "New 960 game",
                    accelerator: "CommandOrControl+Shift+N",
                    click: () => {
                        win.webContents.send("call", "new_960");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Open PGN...",
                    accelerator: "CommandOrControl+O",
                    click: () => {
                        let files = open_dialog(win, {
                            defaultPath: config.pgn_dialog_folder,
                            properties: ["openFile"],
                            filters: [
                                { name: "PGN", extensions: ["pgn"] },
                                { name: "All files", extensions: ["*"] }
                            ]
                        });
                        if (Array.isArray(files) && files.length > 0) {
                            let file = files[0];
                            win.webContents.send("call", {
                                fn: "open",
                                args: [file]
                            });
                            // Save the dir as the new default dir, in both processes.
                            config.pgn_dialog_folder = path.dirname(file);
                            win.webContents.send("set", { pgn_dialog_folder: path.dirname(file) });
                        }
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Load FEN / PGN from clipboard",
                    accelerator: "CommandOrControl+Shift+V",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "load_fen_or_pgn_from_string",
                            args: [clipboard.readText()]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Save this game...",
                    accelerator: "CommandOrControl+S",
                    click: () => {
                        if (config.save_enabled !== true) {
                            // Note: exact test for true, not just any truthy value
                            alert(win, save_not_enabled);
                            return;
                        }
                        let file = save_dialog(win, {
                            defaultPath: config.pgn_dialog_folder,
                            filters: [
                                { name: "PGN", extensions: ["pgn"] },
                                { name: "All files", extensions: ["*"] }
                            ]
                        });
                        if (typeof file === "string" && file.length > 0) {
                            win.webContents.send("call", {
                                fn: "save",
                                args: [file]
                            });
                            // Save the dir as the new default dir, in both processes.
                            config.pgn_dialog_folder = path.dirname(file);
                            win.webContents.send("set", { pgn_dialog_folder: path.dirname(file) });
                        }
                    }
                },
                {
                    label: "Write PGN to clipboard",
                    accelerator: "CommandOrControl+K",
                    click: () => {
                        win.webContents.send("call", "pgn_to_clipboard");
                    }
                },
                {
                    label: "PGN saved statistics",
                    submenu: [
                        {
                            label: "EV",
                            type: "checkbox",
                            checked: config.pgn_ev,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_ev"]
                                });
                            }
                        },
                        {
                            label: "Centipawns",
                            type: "checkbox",
                            checked: config.pgn_cp,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_cp"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "N (%)",
                            type: "checkbox",
                            checked: config.pgn_n,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_n"]
                                });
                            }
                        },
                        {
                            label: "N (absolute)",
                            type: "checkbox",
                            checked: config.pgn_n_abs,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_n_abs"]
                                });
                            }
                        },
                        {
                            label: "...out of total",
                            type: "checkbox",
                            checked: config.pgn_of_n,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_of_n"]
                                });
                            }
                        },
                        {
                            label: "Depth (A/B only)",
                            type: "checkbox",
                            checked: config.pgn_depth,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_depth"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "P",
                            type: "checkbox",
                            checked: config.pgn_p,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_p"]
                                });
                            }
                        },
                        {
                            label: "V",
                            type: "checkbox",
                            checked: config.pgn_v,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_v"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Q",
                            type: "checkbox",
                            checked: config.pgn_q,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_q"]
                                });
                            }
                        },
                        {
                            label: "U",
                            type: "checkbox",
                            checked: config.pgn_u,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_u"]
                                });
                            }
                        },
                        {
                            label: "S",
                            type: "checkbox",
                            checked: config.pgn_s,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_s"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "M",
                            type: "checkbox",
                            checked: config.pgn_m,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_m"]
                                });
                            }
                        },
                        {
                            label: "WDL",
                            type: "checkbox",
                            checked: config.pgn_wdl,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["pgn_wdl"]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Cut",
                    accelerator: "CommandOrControl+X",
                    role: "cut"
                },
                {
                    label: "Copy",
                    accelerator: "CommandOrControl+C",
                    role: "copy"
                },
                {
                    label: "Paste",
                    accelerator: "CommandOrControl+V",
                    role: "paste"
                },
                {
                    type: "separator"
                },
                {
                    label: "Quit", // Presumably calls app.quit(), which tries to
                    accelerator: "CommandOrControl+Q", // close all windows, and quits iff it succeeds (which
                    role: "quit" // it won't, because we prevent the initial close...)
                }
            ]
        },
        {
            label: "Tree",
            submenu: [
                {
                    label: "Play engine choice",
                    submenu: [
                        {
                            label: "1st",
                            accelerator: "F1",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "play_info_index",
                                    args: [0]
                                });
                            }
                        },
                        {
                            label: "2nd",
                            accelerator: "F2",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "play_info_index",
                                    args: [1]
                                });
                            }
                        },
                        {
                            label: "3rd",
                            accelerator: "F3",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "play_info_index",
                                    args: [2]
                                });
                            }
                        },
                        {
                            label: "4th",
                            accelerator: "F4",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "play_info_index",
                                    args: [3]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Root",
                    accelerator: "Home",
                    click: () => {
                        win.webContents.send("call", "goto_root");
                    }
                },
                {
                    label: "End",
                    accelerator: "End",
                    click: () => {
                        win.webContents.send("call", "goto_end");
                    }
                },
                {
                    label: "Backward",
                    accelerator: "Left",
                    click: () => {
                        win.webContents.send("call", "prev");
                    }
                },
                {
                    label: "Forward",
                    accelerator: "Right",
                    click: () => {
                        win.webContents.send("call", "next");
                    }
                },
                {
                    label: "Previous sibling",
                    accelerator: "Up",
                    click: () => {
                        win.webContents.send("call", "previous_sibling");
                    }
                },
                {
                    label: "Next sibling",
                    accelerator: "Down",
                    click: () => {
                        win.webContents.send("call", "next_sibling");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Return to main line",
                    accelerator: "CommandOrControl+R",
                    click: () => {
                        win.webContents.send("call", "return_to_main_line");
                    }
                },
                {
                    label: "Promote line to main line",
                    accelerator: "CommandOrControl+L",
                    click: () => {
                        win.webContents.send("call", "promote_to_main_line");
                    }
                },
                {
                    label: "Promote line by 1 level",
                    accelerator: "CommandOrControl+Up",
                    click: () => {
                        win.webContents.send("call", "promote");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Delete node",
                    accelerator: "CommandOrControl+Backspace",
                    click: () => {
                        win.webContents.send("call", "delete_node");
                    }
                },
                {
                    label: "Delete children",
                    click: () => {
                        win.webContents.send("call", "delete_children");
                    }
                },
                {
                    label: "Delete siblings",
                    click: () => {
                        win.webContents.send("call", "delete_siblings");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Delete ALL other lines",
                    click: () => {
                        win.webContents.send("call", "delete_other_lines");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Show PGN games list",
                    accelerator: "CommandOrControl+P",
                    click: () => {
                        win.webContents.send("call", "show_pgn_chooser");
                    }
                },
                {
                    label: "Escape",
                    accelerator: "Escape",
                    click: () => {
                        win.webContents.send("call", "escape");
                    }
                }
            ]
        },
        {
            label: "Analysis",
            submenu: [
                {
                    label: "Go",
                    accelerator: "CommandOrControl+G",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["analysis_free"]
                        });
                    }
                },
                {
                    label: "Go and lock engine",
                    accelerator: "CommandOrControl+Shift+G",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["analysis_locked"]
                        });
                    }
                },
                {
                    label: "Return to locked position",
                    click: () => {
                        win.webContents.send("call", "return_to_lock");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Halt",
                    accelerator: "CommandOrControl+H",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["halt"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Auto-evaluate line",
                    accelerator: "F12",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["auto_analysis"]
                        });
                    }
                },
                {
                    label: "Auto-evaluate line, backwards",
                    accelerator: "Shift+F12",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["back_analysis"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Show focus (searchmoves) buttons",
                    type: "checkbox",
                    checked: config.searchmoves_buttons,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["searchmoves_buttons"]
                        });
                    }
                },
                {
                    label: "Clear focus",
                    click: () => {
                        win.webContents.send("call", "clear_searchmoves");
                    }
                },
                {
                    label: "Invert focus",
                    accelerator: "CommandOrControl+I",
                    click: () => {
                        win.webContents.send("call", "invert_searchmoves");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Winrate POV",
                    submenu: [
                        {
                            label: "Current",
                            type: "checkbox",
                            checked: config.ev_pov !== "w" && config.ev_pov !== "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Winrate POV", "Current");
                                win.webContents.send("set", { ev_pov: null });
                            }
                        },
                        {
                            label: "White",
                            type: "checkbox",
                            checked: config.ev_pov === "w",
                            click: () => {
                                set_checks(menu, "Analysis", "Winrate POV", "White");
                                win.webContents.send("set", { ev_pov: "w" });
                            }
                        },
                        {
                            label: "Black",
                            type: "checkbox",
                            checked: config.ev_pov === "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Winrate POV", "Black");
                                win.webContents.send("set", { ev_pov: "b" });
                            }
                        }
                    ]
                },
                {
                    label: "Centipawn POV",
                    submenu: [
                        {
                            label: "Current",
                            type: "checkbox",
                            checked: config.cp_pov !== "w" && config.cp_pov !== "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Centipawn POV", "Current");
                                win.webContents.send("set", { cp_pov: null });
                            }
                        },
                        {
                            label: "White",
                            type: "checkbox",
                            checked: config.cp_pov === "w",
                            click: () => {
                                set_checks(menu, "Analysis", "Centipawn POV", "White");
                                win.webContents.send("set", { cp_pov: "w" });
                            }
                        },
                        {
                            label: "Black",
                            type: "checkbox",
                            checked: config.cp_pov === "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Centipawn POV", "Black");
                                win.webContents.send("set", { cp_pov: "b" });
                            }
                        }
                    ]
                },
                {
                    label: "Win / draw / loss POV",
                    submenu: [
                        {
                            label: "Current",
                            type: "checkbox",
                            checked: config.wdl_pov !== "w" && config.wdl_pov !== "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Win / draw / loss POV", "Current");
                                win.webContents.send("set", { wdl_pov: null });
                            }
                        },
                        {
                            label: "White",
                            type: "checkbox",
                            checked: config.wdl_pov === "w",
                            click: () => {
                                set_checks(menu, "Analysis", "Win / draw / loss POV", "White");
                                win.webContents.send("set", { wdl_pov: "w" });
                            }
                        },
                        {
                            label: "Black",
                            type: "checkbox",
                            checked: config.wdl_pov === "b",
                            click: () => {
                                set_checks(menu, "Analysis", "Win / draw / loss POV", "Black");
                                win.webContents.send("set", { wdl_pov: "b" });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "PV clicks",
                    submenu: [
                        {
                            label: "Do nothing",
                            type: "checkbox",
                            checked: config.pv_click_event === 0,
                            click: () => {
                                set_checks(menu, "Analysis", "PV clicks", "Do nothing");
                                win.webContents.send("set", { pv_click_event: 0 });
                            }
                        },
                        {
                            label: "Go there",
                            type: "checkbox",
                            checked: config.pv_click_event === 1,
                            click: () => {
                                set_checks(menu, "Analysis", "PV clicks", "Go there");
                                win.webContents.send("set", { pv_click_event: 1 });
                            }
                        },
                        {
                            label: "Add to tree",
                            type: "checkbox",
                            checked: config.pv_click_event === 2,
                            click: () => {
                                set_checks(menu, "Analysis", "PV clicks", "Add to tree");
                                win.webContents.send("set", { pv_click_event: 2 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Write infobox to clipboard",
                    click: () => {
                        win.webContents.send("call", "infobox_to_clipboard");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Forget all analysis",
                    accelerator: "CommandOrControl+.",
                    click: () => {
                        win.webContents.send("call", "forget_analysis");
                    }
                }
            ]
        },
        {
            label: "Display",
            submenu: [
                {
                    label: "Flip board",
                    accelerator: "CommandOrControl+F",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["flip"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Arrows",
                    type: "checkbox",
                    checked: config.arrows_enabled,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["arrows_enabled"]
                        });
                    }
                },
                {
                    label: "Piece-click spotlight",
                    type: "checkbox",
                    checked: config.click_spotlight,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["click_spotlight"]
                        });
                    }
                },
                {
                    label: "Always show actual move (if known)",
                    type: "checkbox",
                    checked: config.next_move_arrow,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["next_move_arrow"]
                        });
                    }
                },
                {
                    label: "...with unique colour",
                    type: "checkbox",
                    checked: config.next_move_unique_colour,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["next_move_unique_colour"]
                        });
                    }
                },
                {
                    label: "...with outline",
                    type: "checkbox",
                    checked: config.next_move_outline,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["next_move_outline"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Arrowhead type",
                    submenu: [
                        {
                            label: "Winrate",
                            type: "checkbox",
                            checked: config.arrowhead_type === 0,
                            accelerator: "F5",
                            click: () => {
                                set_checks(menu, "Display", "Arrowhead type", "Winrate");
                                win.webContents.send("set", { arrowhead_type: 0 });
                            }
                        },
                        {
                            label: "Node %",
                            type: "checkbox",
                            checked: config.arrowhead_type === 1,
                            accelerator: "F6",
                            click: () => {
                                set_checks(menu, "Display", "Arrowhead type", "Node %");
                                win.webContents.send("set", { arrowhead_type: 1 });
                            }
                        },
                        {
                            label: "Policy",
                            type: "checkbox",
                            checked: config.arrowhead_type === 2,
                            accelerator: "F7",
                            click: () => {
                                set_checks(menu, "Display", "Arrowhead type", "Policy");
                                win.webContents.send("set", { arrowhead_type: 2 });
                            }
                        },
                        {
                            label: "MultiPV rank",
                            type: "checkbox",
                            checked: config.arrowhead_type === 3,
                            accelerator: "F8",
                            click: () => {
                                set_checks(menu, "Display", "Arrowhead type", "MultiPV rank");
                                win.webContents.send("set", { arrowhead_type: 3 });
                            }
                        },
                        {
                            label: "Moves Left Head",
                            type: "checkbox",
                            checked: config.arrowhead_type === 4,
                            click: () => {
                                set_checks(menu, "Display", "Arrowhead type", "Moves Left Head");
                                win.webContents.send("set", { arrowhead_type: 4 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Arrow filter (Lc0)",
                    submenu: [
                        {
                            label: "All moves",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "all",
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "All moves");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["all", 0]
                                });
                            }
                        },
                        {
                            label: "Top move",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "top",
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "Top move");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["top", 0]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "N > 0.5%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.005,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 0.5%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.005]
                                });
                            }
                        },
                        {
                            label: "N > 1%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.01,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 1%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.01]
                                });
                            }
                        },
                        {
                            label: "N > 2%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.02,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 2%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.02]
                                });
                            }
                        },
                        {
                            label: "N > 3%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.03,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 3%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.03]
                                });
                            }
                        },
                        {
                            label: "N > 4%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.04,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 4%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.04]
                                });
                            }
                        },
                        {
                            label: "N > 5%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.05,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 5%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.05]
                                });
                            }
                        },
                        {
                            label: "N > 10%",
                            type: "checkbox",
                            checked: config.arrow_filter_type === "N" && config.arrow_filter_value === 0.1,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (Lc0)", "N > 10%");
                                win.webContents.send("call", {
                                    fn: "set_arrow_filter",
                                    args: ["N", 0.1]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Arrow filter (others)",
                    submenu: [
                        {
                            label: "Diff < 15%",
                            type: "checkbox",
                            checked: config.ab_filter_threshold === 0.15,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (others)", "Diff < 15%");
                                win.webContents.send("set", { ab_filter_threshold: 0.15 });
                            }
                        },
                        {
                            label: "Diff < 10%",
                            type: "checkbox",
                            checked: config.ab_filter_threshold === 0.1,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (others)", "Diff < 10%");
                                win.webContents.send("set", { ab_filter_threshold: 0.1 });
                            }
                        },
                        {
                            label: "Diff < 5%",
                            type: "checkbox",
                            checked: config.ab_filter_threshold === 0.05,
                            click: () => {
                                set_checks(menu, "Display", "Arrow filter (others)", "Diff < 5%");
                                win.webContents.send("set", { ab_filter_threshold: 0.05 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Infobox stats",
                    submenu: [
                        {
                            label: "Centipawns",
                            accelerator: "CommandOrControl+T",
                            type: "checkbox",
                            checked: config.show_cp,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_cp"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "N - nodes (%)",
                            type: "checkbox",
                            checked: config.show_n,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_n"]
                                });
                            }
                        },
                        {
                            label: "N - nodes (absolute)",
                            type: "checkbox",
                            checked: config.show_n_abs,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_n_abs"]
                                });
                            }
                        },
                        {
                            label: "Depth (A/B only)",
                            type: "checkbox",
                            checked: config.show_depth,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_depth"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "P - policy",
                            type: "checkbox",
                            checked: config.show_p,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_p"]
                                });
                            }
                        },
                        {
                            label: "V - static evaluation",
                            type: "checkbox",
                            checked: config.show_v,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_v"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Q - evaluation",
                            type: "checkbox",
                            checked: config.show_q,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_q"]
                                });
                            }
                        },
                        {
                            label: "U - uncertainty",
                            type: "checkbox",
                            checked: config.show_u,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_u"]
                                });
                            }
                        },
                        {
                            label: "S - search priority",
                            type: "checkbox",
                            checked: config.show_s,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_s"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "M - moves left",
                            type: "checkbox",
                            checked: config.show_m,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_m"]
                                });
                            }
                        },
                        {
                            label: "WDL - win / draw / loss",
                            type: "checkbox",
                            checked: config.show_wdl,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["show_wdl"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Linebreak before stats",
                            type: "checkbox",
                            checked: config.infobox_stats_newline,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["infobox_stats_newline"]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "PV move numbers",
                    type: "checkbox",
                    checked: config.infobox_pv_move_numbers,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["infobox_pv_move_numbers"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Online API",
                    submenu: [
                        {
                            label: "None",
                            type: "checkbox",
                            checked: typeof config.looker_api !== "string",
                            click: () => {
                                set_checks(menu, "Display", "Online API", "None");
                                win.webContents.send("call", {
                                    fn: "set_looker_api",
                                    args: [null]
                                });
                            }
                        },
                        {
                            label: "ChessDB.cn evals",
                            type: "checkbox",
                            checked: config.looker_api === "chessdbcn",
                            click: () => {
                                set_checks(menu, "Display", "Online API", "ChessDB.cn evals");
                                win.webContents.send("call", {
                                    fn: "set_looker_api",
                                    args: ["chessdbcn"]
                                });
                            }
                        },
                        {
                            label: "Lichess results (masters)",
                            type: "checkbox",
                            checked: config.looker_api === "lichess_masters",
                            click: () => {
                                set_checks(menu, "Display", "Online API", "Lichess results (masters)");
                                win.webContents.send("call", {
                                    fn: "set_looker_api",
                                    args: ["lichess_masters"]
                                });
                            }
                        },
                        {
                            label: "Lichess results (plebs)",
                            type: "checkbox",
                            checked: config.looker_api === "lichess_plebs",
                            click: () => {
                                set_checks(menu, "Display", "Online API", "Lichess results (plebs)");
                                win.webContents.send("call", {
                                    fn: "set_looker_api",
                                    args: ["lichess_plebs"]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Allow API after move 25",
                    type: "checkbox",
                    checked: config.look_past_25,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["look_past_25"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Draw PV on mouseover",
                    accelerator: "CommandOrControl+D",
                    type: "checkbox",
                    checked: config.hover_draw,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["hover_draw"]
                        });
                    }
                },
                {
                    label: "Draw PV method",
                    submenu: [
                        {
                            label: "Animate",
                            type: "checkbox",
                            checked: config.hover_method === 0,
                            click: () => {
                                set_checks(menu, "Display", "Draw PV method", "Animate");
                                win.webContents.send("set", { hover_method: 0 });
                            }
                        },
                        {
                            label: "Single move",
                            type: "checkbox",
                            checked: config.hover_method === 1,
                            click: () => {
                                set_checks(menu, "Display", "Draw PV method", "Single move");
                                win.webContents.send("set", { hover_method: 1 });
                            }
                        },
                        {
                            label: "Final position",
                            type: "checkbox",
                            checked: config.hover_method === 2,
                            click: () => {
                                set_checks(menu, "Display", "Draw PV method", "Final position");
                                win.webContents.send("set", { hover_method: 2 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Pieces",
                    submenu: [
                        {
                            label: "Choose pieces folder...",
                            click: () => {
                                let folders = open_dialog(win, {
                                    defaultPath: config.pieces_dialog_folder,
                                    properties: ["openDirectory"]
                                });
                                if (Array.isArray(folders) && folders.length > 0) {
                                    let folder = folders[0];
                                    win.webContents.send("call", {
                                        fn: "change_piece_set",
                                        args: [folder]
                                    });
                                    // Save the dir as the new default dir, in both processes.
                                    config.pieces_dialog_folder = path.dirname(folder);
                                    win.webContents.send("set", { pieces_dialog_folder: path.dirname(folder) });
                                }
                            }
                        },
                        {
                            label: "Default",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "change_piece_set",
                                    args: [null]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "About custom pieces",
                            click: () => {
                                alert(win, about_custom_pieces);
                            }
                        }
                    ]
                },
                {
                    label: "Background",
                    submenu: [
                        {
                            label: "Choose background image...",
                            click: () => {
                                let files = open_dialog(win, {
                                    defaultPath: config.background_dialog_folder,
                                    properties: ["openFile"]
                                });
                                if (Array.isArray(files) && files.length > 0) {
                                    let file = files[0];
                                    win.webContents.send("call", {
                                        fn: "change_background",
                                        args: [file]
                                    });
                                    // Save the dir as the new default dir, in both processes.
                                    config.background_dialog_folder = path.dirname(file);
                                    win.webContents.send("set", { background_dialog_folder: path.dirname(file) });
                                }
                            }
                        },
                        {
                            label: "Default",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "change_background",
                                    args: [null]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Book frequency arrows",
                    type: "checkbox",
                    checked: config.book_explorer, // But this is never saved in the config file.
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["book_explorer"] // The hub will automatically turn off lichess weights mode.
                        });
                        set_one_check(false, menu, "Display", "Lichess frequency arrows");
                    }
                },
                {
                    label: "Lichess frequency arrows",
                    type: "checkbox",
                    accelerator: "CommandOrControl+E",
                    checked: config.lichess_explorer, // But this is never saved in the config file.
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["lichess_explorer"] // The hub will automatically turn off book weights mode.
                        });
                        set_one_check(false, menu, "Display", "Book frequency arrows");
                    }
                }
            ]
        },
        {
            label: "Sizes",
            submenu: [
                {
                    label: "Infobox font",
                    submenu: [
                        {
                            label: "32",
                            type: "checkbox",
                            checked: config.info_font_size === 32,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "32");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [32]
                                });
                            }
                        },
                        {
                            label: "28",
                            type: "checkbox",
                            checked: config.info_font_size === 28,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "28");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [28]
                                });
                            }
                        },
                        {
                            label: "24",
                            type: "checkbox",
                            checked: config.info_font_size === 24,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "24");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [24]
                                });
                            }
                        },
                        {
                            label: "20",
                            type: "checkbox",
                            checked: config.info_font_size === 20,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "20");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [20]
                                });
                            }
                        },
                        {
                            label: "18",
                            type: "checkbox",
                            checked: config.info_font_size === 18,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "18");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [18]
                                });
                            }
                        },
                        {
                            label: "16",
                            type: "checkbox",
                            checked: config.info_font_size === 16,
                            click: () => {
                                set_checks(menu, "Sizes", "Infobox font", "16");
                                win.webContents.send("call", {
                                    fn: "set_info_font_size",
                                    args: [16]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Move history font",
                    submenu: [
                        {
                            label: "32",
                            type: "checkbox",
                            checked: config.pgn_font_size === 32,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "32");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [32]
                                });
                            }
                        },
                        {
                            label: "28",
                            type: "checkbox",
                            checked: config.pgn_font_size === 28,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "28");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [28]
                                });
                            }
                        },
                        {
                            label: "24",
                            type: "checkbox",
                            checked: config.pgn_font_size === 24,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "24");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [24]
                                });
                            }
                        },
                        {
                            label: "20",
                            type: "checkbox",
                            checked: config.pgn_font_size === 20,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "20");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [20]
                                });
                            }
                        },
                        {
                            label: "18",
                            type: "checkbox",
                            checked: config.pgn_font_size === 18,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "18");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [18]
                                });
                            }
                        },
                        {
                            label: "16",
                            type: "checkbox",
                            checked: config.pgn_font_size === 16,
                            click: () => {
                                set_checks(menu, "Sizes", "Move history font", "16");
                                win.webContents.send("call", {
                                    fn: "set_pgn_font_size",
                                    args: [16]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Board",
                    submenu: [
                        {
                            label: "1280",
                            type: "checkbox",
                            checked: config.board_size === 1280,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "1280");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [1280]
                                });
                            }
                        },
                        {
                            label: "1120",
                            type: "checkbox",
                            checked: config.board_size === 1120,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "1120");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [1120]
                                });
                            }
                        },
                        {
                            label: "960",
                            type: "checkbox",
                            checked: config.board_size === 960,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "960");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [960]
                                });
                            }
                        },
                        {
                            label: "800",
                            type: "checkbox",
                            checked: config.board_size === 800,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "800");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [800]
                                });
                            }
                        },
                        {
                            label: "640",
                            type: "checkbox",
                            checked: config.board_size === 640,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "640");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [640]
                                });
                            }
                        },
                        {
                            label: "576",
                            type: "checkbox",
                            checked: config.board_size === 576,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "576");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [576]
                                });
                            }
                        },
                        {
                            label: "512",
                            type: "checkbox",
                            checked: config.board_size === 512,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "512");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [512]
                                });
                            }
                        },
                        {
                            label: "480",
                            type: "checkbox",
                            checked: config.board_size === 480,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "480");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [480]
                                });
                            }
                        },
                        {
                            label: "448",
                            type: "checkbox",
                            checked: config.board_size === 448,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "448");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [448]
                                });
                            }
                        },
                        {
                            label: "416",
                            type: "checkbox",
                            checked: config.board_size === 416,
                            click: () => {
                                set_checks(menu, "Sizes", "Board", "416");
                                win.webContents.send("call", {
                                    fn: "set_board_size",
                                    args: [416]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Arrows",
                    submenu: [
                        {
                            label: "Giant",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_arrow_size",
                                    args: [24, 32, 40]
                                });
                            }
                        },
                        {
                            label: "Large",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_arrow_size",
                                    args: [16, 24, 32]
                                });
                            }
                        },
                        {
                            label: "Medium",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_arrow_size",
                                    args: [12, 18, 24]
                                });
                            }
                        },
                        {
                            label: "Small",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_arrow_size",
                                    args: [8, 12, 18]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Graph",
                    submenu: [
                        {
                            label: "192",
                            type: "checkbox",
                            checked: config.graph_height === 192,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "192");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [192]
                                });
                            }
                        },
                        {
                            label: "160",
                            type: "checkbox",
                            checked: config.graph_height === 160,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "160");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [160]
                                });
                            }
                        },
                        {
                            label: "128",
                            type: "checkbox",
                            checked: config.graph_height === 128,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "128");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [128]
                                });
                            }
                        },
                        {
                            label: "96",
                            type: "checkbox",
                            checked: config.graph_height === 96,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "96");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [96]
                                });
                            }
                        },
                        {
                            label: "64",
                            type: "checkbox",
                            checked: config.graph_height === 64,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "64");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [64]
                                });
                            }
                        },
                        {
                            label: "48",
                            type: "checkbox",
                            checked: config.graph_height === 48,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "48");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [48]
                                });
                            }
                        },
                        {
                            label: "32",
                            type: "checkbox",
                            checked: config.graph_height === 32,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "32");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [32]
                                });
                            }
                        },
                        {
                            label: "0",
                            type: "checkbox",
                            checked: config.graph_height === 0,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph", "0");
                                win.webContents.send("call", {
                                    fn: "set_graph_height",
                                    args: [0]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Graph lines",
                    submenu: [
                        {
                            label: "8",
                            type: "checkbox",
                            checked: config.graph_line_width === 8,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "8");
                                win.webContents.send("set", { graph_line_width: 8 });
                            }
                        },
                        {
                            label: "7",
                            type: "checkbox",
                            checked: config.graph_line_width === 7,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "7");
                                win.webContents.send("set", { graph_line_width: 7 });
                            }
                        },
                        {
                            label: "6",
                            type: "checkbox",
                            checked: config.graph_line_width === 6,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "6");
                                win.webContents.send("set", { graph_line_width: 6 });
                            }
                        },
                        {
                            label: "5",
                            type: "checkbox",
                            checked: config.graph_line_width === 5,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "5");
                                win.webContents.send("set", { graph_line_width: 5 });
                            }
                        },
                        {
                            label: "4",
                            type: "checkbox",
                            checked: config.graph_line_width === 4,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "4");
                                win.webContents.send("set", { graph_line_width: 4 });
                            }
                        },
                        {
                            label: "3",
                            type: "checkbox",
                            checked: config.graph_line_width === 3,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "3");
                                win.webContents.send("set", { graph_line_width: 3 });
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: config.graph_line_width === 2,
                            click: () => {
                                set_checks(menu, "Sizes", "Graph lines", "2");
                                win.webContents.send("set", { graph_line_width: 2 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "I want other size options!",
                    click: () => {
                        alert(win, about_sizes);
                    }
                }
            ]
        },
        {
            label: "Engine",
            submenu: [
                {
                    label: "Choose engine...",
                    type: "checkbox",
                    checked: false,
                    click: () => {
                        let files = open_dialog(win, {
                            defaultPath: config.engine_dialog_folder,
                            properties: ["openFile"]
                        });
                        if (Array.isArray(files) && files.length > 0) {
                            let file = files[0];
                            if (file === process.argv[0] || path.basename(file).includes("client")) {
                                alert(win, wrong_engine_exe);
                                win.webContents.send("call", "send_ack_engine"); // Force an ack IPC to fix our menu check state.
                                return;
                            }
                            win.webContents.send("call", {
                                fn: "switch_engine",
                                args: [file]
                            });
                            // Save the dir as the new default dir, in both processes.
                            config.engine_dialog_folder = path.dirname(file);
                            win.webContents.send("set", { engine_dialog_folder: path.dirname(file) });
                        } else {
                            win.webContents.send("call", "send_ack_engine"); // Force an ack IPC to fix our menu check state.
                        }
                    }
                },
                {
                    label: "Choose known engine...",
                    click: () => {
                        win.webContents.send("call", "show_fast_engine_chooser");
                    }
                },
                {
                    label: "Weights",
                    submenu: [
                        {
                            label: "Lc0 WeightsFile...",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                let files = open_dialog(win, {
                                    defaultPath: config.weights_dialog_folder,
                                    properties: ["openFile"]
                                });
                                if (Array.isArray(files) && files.length > 0) {
                                    let file = files[0];
                                    win.webContents.send("call", {
                                        fn: "set_uci_option_permanent",
                                        args: ["WeightsFile", file]
                                    });
                                    // Will receive an ack IPC which sets menu checks.
                                    // Save the dir as the new default dir, in both processes.
                                    config.weights_dialog_folder = path.dirname(file);
                                    win.webContents.send("set", { weights_dialog_folder: path.dirname(file) });
                                } else {
                                    win.webContents.send("call", {
                                        // Force an ack IPC to fix our menu check state.
                                        fn: "send_ack_setoption",
                                        args: ["WeightsFile"]
                                    });
                                }
                            }
                        },
                        {
                            label: "Stockfish EvalFile...",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                let files = open_dialog(win, {
                                    defaultPath: config.evalfile_dialog_folder,
                                    properties: ["openFile"]
                                });
                                if (Array.isArray(files) && files.length > 0) {
                                    let file = files[0];
                                    win.webContents.send("call", {
                                        fn: "set_uci_option_permanent",
                                        args: ["EvalFile", file]
                                    });
                                    // Will receive an ack IPC which sets menu checks.
                                    // Save the dir as the new default dir, in both processes.
                                    config.evalfile_dialog_folder = path.dirname(file);
                                    win.webContents.send("set", { evalfile_dialog_folder: path.dirname(file) });
                                } else {
                                    win.webContents.send("call", {
                                        // Force an ack IPC to fix our menu check state.
                                        fn: "send_ack_setoption",
                                        args: ["EvalFile"]
                                    });
                                }
                            }
                        },
                        {
                            label: "Set to <auto>",
                            click: () => {
                                win.webContents.send("call", "auto_weights");
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "Backend",
                    submenu: [
                        {
                            label: "cuda-auto",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cuda-auto"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "cuda",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cuda"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "cuda-fp16",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cuda-fp16"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "cudnn-auto",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cudnn-auto"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "cudnn",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cudnn"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "cudnn-fp16",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "cudnn-fp16"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "blas",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "blas"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "dx12",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "dx12"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "eigen",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "eigen"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "metal",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "metal"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "onednn",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "onednn"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "opencl",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "opencl"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "xla",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "xla"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "tensorflow-cc",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "tensorflow-cc"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "tensorflow-cc-cpu",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "tensorflow-cc-cpu"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "onnx-cpu",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "onnx-cpu"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "onnx-cuda",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "onnx-cuda"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "onnx-dml",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "onnx-dml"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "onnx-rocm",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "onnx-rocm"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "random",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "random"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "trivial",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "trivial"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "demux",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "demux"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "multiplexing",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "multiplexing"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "roundrobin",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Backend", "roundrobin"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Choose Syzygy path...",
                    type: "checkbox",
                    checked: false,
                    click: () => {
                        let folders = open_dialog(win, {
                            defaultPath: config.syzygy_dialog_folder,
                            properties: ["openDirectory"]
                        });
                        if (Array.isArray(folders) && folders.length > 0) {
                            let folder = folders[0];
                            win.webContents.send("call", {
                                fn: "set_uci_option_permanent",
                                args: ["SyzygyPath", folder] // FIXME: should send all folders, separated by system separator.
                            });
                            // Will receive an ack IPC which sets menu checks.
                            // Save the dir as the new default dir, in both processes.
                            config.syzygy_dialog_folder = path.dirname(folder);
                            win.webContents.send("set", { syzygy_dialog_folder: path.dirname(folder) });
                        } else {
                            win.webContents.send("call", {
                                fn: "send_ack_setoption",
                                args: ["SyzygyPath"] // Force an ack IPC to fix our menu check state.
                            });
                        }
                    }
                },
                {
                    label: "Unset",
                    click: () => {
                        win.webContents.send("call", "disable_syzygy");
                        // Will receive an ack IPC which sets menu checks.
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Limit - normal",
                    submenu: [
                        {
                            label: "Unlimited",
                            accelerator: "CommandOrControl+U",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [null]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "1,000,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [1 * billion]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [100 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [10 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [1 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [100000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [10000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [1000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [100]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [10]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit",
                                    args: [1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Up slightly",
                            accelerator: "CommandOrControl+=",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "adjust_node_limit",
                                    args: [1, false]
                                });
                            }
                        },
                        {
                            label: "Down slightly",
                            accelerator: "CommandOrControl+-",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "adjust_node_limit",
                                    args: [-1, false]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Limit - auto-eval / play",
                    submenu: [
                        {
                            label: "1,000,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [1 * billion]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [100 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [10 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1,000,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [1 * million]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [100000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [10000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1,000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [1000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [100]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [10]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_node_limit_special",
                                    args: [1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Up slightly",
                            accelerator: "CommandOrControl+]",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "adjust_node_limit",
                                    args: [1, true]
                                });
                            }
                        },
                        {
                            label: "Down slightly",
                            accelerator: "CommandOrControl+[",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "adjust_node_limit",
                                    args: [-1, true]
                                });
                            }
                        }
                    ]
                },
                {
                    label: "Limit by time instead of nodes",
                    type: "checkbox",
                    checked: false,
                    click: () => {
                        win.webContents.send("call", "toggle_limit_by_time");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Threads",
                    submenu: [
                        {
                            label: "128",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 128]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "96",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 96]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "64",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 64]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "48",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 48]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "32",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 32]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "24",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 24]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "16",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 16]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "14",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 14]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "12",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 12]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 10]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "8",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 8]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "7",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 7]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "6",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 6]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "5",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 5]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "4",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 4]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "3",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 3]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Threads", 1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Warning about threads",
                            click: () => {
                                alert(win, thread_warning);
                            }
                        }
                    ]
                },
                {
                    label: "Hash",
                    submenu: [
                        {
                            label: "120 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 120 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "56 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 56 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "24 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 24 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "12 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 12 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "8 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 8 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "6 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 6 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "4 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 4 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 2 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 1 * 1024]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0 GB",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Hash", 1] // 1 MB is Stockfish actual minimum.
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "I want other hash options!",
                            click: () => {
                                alert(win, about_hashes);
                            }
                        }
                    ]
                },
                {
                    label: "MultiPV",
                    submenu: [
                        {
                            label: "5",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["MultiPV", 5]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "4",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["MultiPV", 4]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "3",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["MultiPV", 3]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["MultiPV", 2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "1",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["MultiPV", 1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Contempt Mode", // Other valid options are "play" (which messes with normal analysis) and "disable"
                    submenu: [
                        {
                            label: "White analysis", // Note string searched when ack'd.
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["ContemptMode", "white_side_analysis"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "Black analysis", // Note string searched when ack'd.
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["ContemptMode", "black_side_analysis"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "Contempt",
                    submenu: [
                        {
                            label: "250",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 250]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "200",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 200]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "150",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 150]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "100",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 100]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "50",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 50]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", 0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "-50",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", -50]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "-100",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", -100]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "-150",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", -150]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "-200",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", -200]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "-250",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["Contempt", -250]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "WDL Calibration Elo",
                    submenu: [
                        {
                            label: "3600",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 3600]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "3400",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 3400]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "3200",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 3200]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "3000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 3000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2800",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 2800]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2600",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 2600]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2400",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 2400]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2200",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 2200]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2000",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 2000]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Use default WDL", // This string is searched for when receiving ack 0, don't edit this alone.
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent_and_cleartree",
                                    args: ["WDLCalibrationElo", 0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "WDL Eval Objectivity",
                    submenu: [
                        {
                            label: "Yes",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["WDLEvalObjectivity", 1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "No",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["WDLEvalObjectivity", 0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "Score Type",
                    submenu: [
                        {
                            label: "WDL_mu",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["ScoreType", "WDL_mu"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "centipawn",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["ScoreType", "centipawn"]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Custom scripts",
                    submenu: scriptlist_in_menu // Will be filled at the end, see below.
                },
                {
                    type: "separator"
                },
                {
                    label: "Restart engine",
                    click: () => {
                        win.webContents.send("call", "restart_engine");
                    }
                },
                {
                    label: "Soft engine reset",
                    click: () => {
                        win.webContents.send("call", "soft_engine_reset");
                    }
                }
            ]
        },
        {
            label: "Play",
            submenu: [
                {
                    label: "Play this colour",
                    accelerator: "F9",
                    click: () => {
                        win.webContents.send("call", "play_this_colour");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Start self-play",
                    accelerator: "F11",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["self_play"]
                        });
                    }
                },
                {
                    label: "Halt",
                    click: () => {
                        win.webContents.send("call", {
                            fn: "set_behaviour",
                            args: ["halt"]
                        });
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Use Polyglot book...",
                    type: "checkbox",
                    checked: false,
                    click: () => {
                        let files = open_dialog(win, {
                            defaultPath: config.book_dialog_folder,
                            properties: ["openFile"],
                            filters: [
                                { name: "Polyglot", extensions: ["bin"] },
                                { name: "All files", extensions: ["*"] }
                            ]
                        });
                        if (Array.isArray(files) && files.length > 0) {
                            let file = files[0];
                            win.webContents.send("call", {
                                fn: "load_polyglot_book",
                                args: [file]
                            });
                            // Will receive an ack IPC which sets menu checks.
                            // Save the dir as the new default dir, in both processes.
                            config.book_dialog_folder = path.dirname(file);
                            win.webContents.send("set", { book_dialog_folder: path.dirname(file) });
                        } else {
                            win.webContents.send("call", "send_ack_book"); // Force an ack IPC to fix our menu check state.
                        }
                    }
                },
                {
                    label: "Use PGN book...",
                    type: "checkbox",
                    checked: false,
                    click: () => {
                        let files = open_dialog(win, {
                            defaultPath: config.book_dialog_folder,
                            properties: ["openFile"],
                            filters: [
                                { name: "PGN", extensions: ["pgn"] },
                                { name: "All files", extensions: ["*"] }
                            ]
                        });
                        if (Array.isArray(files) && files.length > 0) {
                            let file = files[0];
                            win.webContents.send("call", {
                                fn: "load_pgn_book",
                                args: [file]
                            });
                            // Will receive an ack IPC which sets menu checks.
                            // Save the dir as the new default dir, in both processes.
                            config.book_dialog_folder = path.dirname(file);
                            win.webContents.send("set", { book_dialog_folder: path.dirname(file) });
                        } else {
                            win.webContents.send("call", "send_ack_book"); // Force an ack IPC to fix our menu check state.
                        }
                    }
                },
                {
                    label: "Unload book / abort load",
                    click: () => {
                        win.webContents.send("call", "unload_book");
                        // Will receive an ack IPC which sets menu checks.
                    }
                },
                {
                    label: "Book depth limit",
                    submenu: [
                        {
                            label: "Unlimited",
                            type: "checkbox",
                            checked: typeof config.book_depth !== "number",
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "Unlimited");
                                win.webContents.send("set", { book_depth: null });
                            }
                        },
                        {
                            label: "20",
                            type: "checkbox",
                            checked: config.book_depth === 20,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "20");
                                win.webContents.send("set", { book_depth: 20 });
                            }
                        },
                        {
                            label: "18",
                            type: "checkbox",
                            checked: config.book_depth === 18,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "18");
                                win.webContents.send("set", { book_depth: 18 });
                            }
                        },
                        {
                            label: "16",
                            type: "checkbox",
                            checked: config.book_depth === 16,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "16");
                                win.webContents.send("set", { book_depth: 16 });
                            }
                        },
                        {
                            label: "14",
                            type: "checkbox",
                            checked: config.book_depth === 14,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "14");
                                win.webContents.send("set", { book_depth: 14 });
                            }
                        },
                        {
                            label: "12",
                            type: "checkbox",
                            checked: config.book_depth === 12,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "12");
                                win.webContents.send("set", { book_depth: 12 });
                            }
                        },
                        {
                            label: "10",
                            type: "checkbox",
                            checked: config.book_depth === 10,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "10");
                                win.webContents.send("set", { book_depth: 10 });
                            }
                        },
                        {
                            label: "8",
                            type: "checkbox",
                            checked: config.book_depth === 8,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "8");
                                win.webContents.send("set", { book_depth: 8 });
                            }
                        },
                        {
                            label: "6",
                            type: "checkbox",
                            checked: config.book_depth === 6,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "6");
                                win.webContents.send("set", { book_depth: 6 });
                            }
                        },
                        {
                            label: "4",
                            type: "checkbox",
                            checked: config.book_depth === 4,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "4");
                                win.webContents.send("set", { book_depth: 4 });
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: config.book_depth === 2,
                            click: () => {
                                set_checks(menu, "Play", "Book depth limit", "2");
                                win.webContents.send("set", { book_depth: 2 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Temperature",
                    submenu: [
                        {
                            label: "1.0",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 1.0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.9",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.9]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.8",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.8]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.7",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.7]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.6",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.6]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.5",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.5]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.4",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.4]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.3",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.3]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0.1",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0.1]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "0",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["Temperature", 0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    label: "Temp Decay Moves",
                    submenu: [
                        {
                            label: "Infinite",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 0]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "20",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 20]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "18",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 18]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "16",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 16]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "14",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 14]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "12",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 12]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "10",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 10]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "8",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 8]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "6",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 6]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "4",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 4]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            label: "2",
                            type: "checkbox",
                            checked: false,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_uci_option_permanent",
                                    args: ["TempDecayMoves", 2]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "About play modes",
                    click: () => {
                        alert(win, about_versus_mode);
                    }
                }
            ]
        },
        {
            label: "Dev",
            submenu: [
                {
                    role: "toggledevtools"
                },
                {
                    label: "Toggle Debug CSS",
                    click: () => {
                        win.webContents.send("call", "toggle_debug_css");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Permanently enable save",
                    click: () => {
                        config.save_enabled = true; // The main process actually uses this variable...
                        win.webContents.send("set", { save_enabled: true }); // But it's the renderer process that saves the config file.
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: `Show ${configFilename}`,
                    click: () => {
                        shell.showItemInFolder(configFilepath);
                    }
                },
                {
                    label: `Show ${engineFilename}`,
                    click: () => {
                        shell.showItemInFolder(engineFilepath);
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: `Reload ${engineFilename} (and restart engine)`,
                    click: () => {
                        win.webContents.send("call", "reload_engineconfig");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Random move",
                    accelerator: "CommandOrControl+/",
                    click: () => {
                        win.webContents.send("call", "random_move");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Disable hardware acceleration for GUI",
                    type: "checkbox",
                    checked: config.disable_hw_accel,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["disable_hw_accel"]
                        });
                        if (!have_warned_hw_accel_setting) {
                            alert(win, "This will not take effect until you restart the GUI.");
                            have_warned_hw_accel_setting = true;
                        }
                    }
                },
                {
                    label: "Spin rate",
                    submenu: [
                        {
                            label: "Frenetic",
                            type: "checkbox",
                            checked: config.update_delay === 25,
                            click: () => {
                                set_checks(menu, "Dev", "Spin rate", "Frenetic");
                                win.webContents.send("set", { update_delay: 25 });
                            }
                        },
                        {
                            label: "Fast",
                            type: "checkbox",
                            checked: config.update_delay === 60,
                            click: () => {
                                set_checks(menu, "Dev", "Spin rate", "Fast");
                                win.webContents.send("set", { update_delay: 60 });
                            }
                        },
                        {
                            label: "Normal",
                            type: "checkbox",
                            checked: config.update_delay === 125,
                            click: () => {
                                set_checks(menu, "Dev", "Spin rate", "Normal");
                                win.webContents.send("set", { update_delay: 125 });
                            }
                        },
                        {
                            label: "Relaxed",
                            type: "checkbox",
                            checked: config.update_delay === 170,
                            click: () => {
                                set_checks(menu, "Dev", "Spin rate", "Relaxed");
                                win.webContents.send("set", { update_delay: 170 });
                            }
                        },
                        {
                            label: "Lazy",
                            type: "checkbox",
                            checked: config.update_delay === 250,
                            click: () => {
                                set_checks(menu, "Dev", "Spin rate", "Lazy");
                                win.webContents.send("set", { update_delay: 250 });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Show engine state",
                    type: "checkbox",
                    checked: config.show_engine_state,
                    click: () => {
                        win.webContents.send("call", {
                            fn: "toggle",
                            args: ["show_engine_state"]
                        });
                    }
                },
                {
                    label: "List sent options",
                    click: () => {
                        win.webContents.send("call", "show_sent_options");
                    }
                },
                {
                    label: "Show error log",
                    click: () => {
                        win.webContents.send("call", "show_error_log");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Hacks and kludges",
                    submenu: [
                        {
                            label: "Allow arbitrary scripts",
                            type: "checkbox",
                            checked: config.allow_arbitrary_scripts,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["allow_arbitrary_scripts"]
                                });
                            }
                        },
                        {
                            label: "Accept any file size",
                            type: "checkbox",
                            checked: config.ignore_filesize_limits,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["ignore_filesize_limits"]
                                });
                            }
                        },
                        {
                            label: "Allow stopped analysis",
                            type: "checkbox",
                            checked: config.allow_stopped_analysis,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["allow_stopped_analysis"]
                                });
                            }
                        },
                        {
                            label: "Never hide focus buttons",
                            type: "checkbox",
                            checked: config.never_suppress_searchmoves,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["never_suppress_searchmoves"]
                                });
                            }
                        },
                        {
                            label: "Never grayout move info",
                            type: "checkbox",
                            checked: config.never_grayout_infolines,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["never_grayout_infolines"]
                                });
                            }
                        },
                        {
                            label: "Use lowerbound / upperbound info",
                            type: "checkbox",
                            checked: config.accept_bounds,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["accept_bounds"]
                                });
                            }
                        },
                        {
                            label: "Suppress ucinewgame",
                            type: "checkbox",
                            checked: config.suppress_ucinewgame,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["suppress_ucinewgame"]
                                });
                            }
                        }
                    ]
                },
                {
                    type: "separator"
                },
                {
                    label: "Log RAM state to console",
                    click: () => {
                        win.webContents.send("call", "log_ram");
                    }
                },
                {
                    label: "Fire GC",
                    click: () => {
                        win.webContents.send("call", "fire_gc");
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Logging",
                    submenu: [
                        {
                            label: "Use logfile...",
                            type: "checkbox",
                            checked: typeof config.logfile === "string" && config.logfile !== "",
                            click: () => {
                                let file = save_dialog(win, {});
                                if (typeof file === "string" && file.length > 0) {
                                    win.webContents.send("call", {
                                        fn: "set_logfile",
                                        args: [file]
                                    });
                                    // Will receive an ack IPC which sets menu checks.
                                } else {
                                    win.webContents.send("call", "send_ack_logfile"); // Force an ack IPC to fix our menu check state.
                                }
                            }
                        },
                        {
                            label: "Disable logging",
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "set_logfile",
                                    args: [null]
                                });
                                // Will receive an ack IPC which sets menu checks.
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Clear log when opening",
                            type: "checkbox",
                            checked: config.clear_log,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["clear_log"]
                                });
                            }
                        },
                        {
                            label: "Use unique logfile each time",
                            type: "checkbox",
                            checked: config.logfile_timestamp,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["logfile_timestamp"]
                                });
                            }
                        },
                        {
                            type: "separator"
                        },
                        {
                            label: "Log illegal moves",
                            type: "checkbox",
                            checked: config.log_illegal_moves,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["log_illegal_moves"]
                                });
                            }
                        },
                        {
                            label: "Log positions",
                            type: "checkbox",
                            checked: config.log_positions,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["log_positions"]
                                });
                            }
                        },
                        {
                            label: "Log info lines",
                            type: "checkbox",
                            checked: config.log_info_lines,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["log_info_lines"]
                                });
                            }
                        },
                        {
                            label: "...including useless lines",
                            type: "checkbox",
                            checked: config.log_useless_info,
                            click: () => {
                                win.webContents.send("call", {
                                    fn: "toggle",
                                    args: ["log_useless_info"]
                                });
                            }
                        }
                    ]
                }
            ]
        }
    ];

    // Some special shennanigans to build the custom scripts menu...

    let scriptlist = loadCustomUCI();

    for (let script of scriptlist) {
        scriptlist_in_menu.push({
            label: script.name,
            click: () => {
                win.webContents.send("call", {
                    fn: "run_script",
                    args: [script.path]
                });
            }
        });
    }

    if (scriptlist_in_menu.length > 0) {
        scriptlist_in_menu.push({ type: "separator" });
    }
    scriptlist_in_menu.push({
        label: "How to add scripts",
        click: () => {
            alert(win, adding_scripts);
        }
    });
    scriptlist_in_menu.push({
        label: `Show scripts folder`,
        click: () => {
            shell.showItemInFolder(script_dir_path);
        }
    });

    // Actually build the menu...
    // FIXME: TypeScript....
    return Menu.buildFromTemplate(template as any);
}

function get_submenu_items(menu: Menu, menupath: string[]) {
    // If the path is to a submenu, this returns a list of all items in the submenu.
    // If the path is to a specific menu item, it just returns that item.

    let o = menu.items;
    for (let p of menupath) {
        p = stringify(p);
        for (let item of o) {
            if (item.label === p) {
                if (item.submenu) {
                    o = item.submenu.items;
                    break;
                } else {
                    return item; // No submenu so this must be the end.
                }
            }
        }
    }
    return o;
}

function set_checks(menu: Menu, ...menupath: string[]) {
    if (!menu_is_set) {
        return;
    }

    // Since I don't know precisely how the menu works behind the scenes,
    // give a little time for the original click to go through first.

    setTimeout(() => {
        let items = get_submenu_items(menu, menupath.slice(0, -1));
        if (Array.isArray(items)) {
            for (let n = 0; n < items.length; n++) {
                if (items[n].checked !== undefined) {
                    items[n].checked = items[n].label === stringify(menupath[menupath.length - 1]);
                }
            }
        }
    }, 50);
}

function set_one_check(state: boolean, menu: Menu, ...menupath: string[]) {
    state = state ? true : false;

    if (!menu_is_set) {
        return;
    }

    let item = get_submenu_items(menu, menupath);
    if (Array.isArray(item)) {
    } else {
        if (item.checked !== undefined) {
            item.checked = state;
        }
    }
}
