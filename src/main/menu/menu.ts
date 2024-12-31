import { BrowserWindow, Menu, MenuItemConstructorOptions, dialog } from "electron";
import * as path from "path";
import { CHANNEL_ACTION_BOARD_FLIP, CHANNEL_ENGINE_CHANGED } from "../../shared/ipc-constants";
import { menu_file } from "./menu.file";
import { menu_tree } from "./menu.tree";

export interface MenuHandler {
    getEngineFolder(): string;
    setEngineFolder(engineFolder: string): void;
    restart_engine(): Promise<void>;
    switch_engine(file: string): Promise<void>;
}

const save_dialog = dialog.showSaveDialogSync || dialog.showSaveDialog;
const open_dialog = dialog.showOpenDialogSync || dialog.showOpenDialog;

export function menu_build(win: BrowserWindow, handler: MenuHandler): Menu {
    const template: MenuItemConstructorOptions[] = [
        menu_file(win),
        menu_tree(win),
        board_menu_items(win),
        engine_menu_items(win, handler), help_menu_items()];
    return Menu.buildFromTemplate(template);
}

function board_menu_items(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Board",
        submenu: [menu_item_board_flip(win)]
    };
    return items;
}

function menu_item_board_flip(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Flip",
        accelerator: "CommandOrControl+F",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_BOARD_FLIP);
        }
    };
    return items;
}

function engine_menu_items(win: BrowserWindow, handler: MenuHandler): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Engine",
        submenu: [
            {
                label: "Choose...",
                click: () => {
                    const files = open_dialog(win, {
                        defaultPath: handler.getEngineFolder(),
                        properties: ["openFile"]
                    });
                    if (Array.isArray(files) && files.length > 0) {
                        const file = files[0];
                        if (file === process.argv[0] || path.basename(file).includes("client")) {
                            // alert(win, messages.wrong_engine_exe);
                            win.webContents.send("call", "send_ack_engine"); // Force an ack IPC to fix our menu check state.
                            return;
                        }
                        handler.switch_engine(file);
                        win.webContents.send(CHANNEL_ENGINE_CHANGED, file);
                        // e.g. /usr/games/stockfish
                        win.webContents.send("call", {
                            fn: "switch_engine",
                            args: [file]
                        });
                        // Save the dir as the new default dir, in both processes.
                        // config.engine_dialog_folder = path.dirname(file);
                        win.webContents.send("set", { engine_dialog_folder: path.dirname(file) });
                    } else {
                        console.log(`otherwise ${JSON.stringify(files)}`);
                        win.webContents.send("call", "send_ack_engine"); // Force an ack IPC to fix our menu check state.
                    }
                }
            }
        ]
    };
    return items;
}

function help_menu_items(): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Help",
        submenu: [
            {
                role: "toggleDevTools"
            },
            {
                type: "separator"
            },
            {
                label: "About",
                click: () => {
                    console.log("click() Help > About");
                }
            }
        ]
    };
    return items;
}
