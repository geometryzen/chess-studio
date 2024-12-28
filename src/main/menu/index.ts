import { BrowserWindow, Menu, MenuItemConstructorOptions, dialog } from "electron";
import * as path from "path";

export interface MenuHandler {
    onChangeEngine(file: string): void;
}

const save_dialog = dialog.showSaveDialogSync || dialog.showSaveDialog;
const open_dialog = dialog.showOpenDialogSync || dialog.showOpenDialog;

export function menu_build(win: BrowserWindow, handler: MenuHandler): Menu {
    const template: MenuItemConstructorOptions[] = [engine_menu_items(win, handler), help_menu_items()];
    return Menu.buildFromTemplate(template);
}

function engine_menu_items(win: BrowserWindow, handler: MenuHandler): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Engine",
        submenu: [
            {
                label: "Choose...",
                click: () => {
                    console.log("click() Engine > Choose");
                    const files = open_dialog(win, {
                        // defaultPath: config.engine_dialog_folder,
                        properties: ["openFile"]
                    });
                    if (Array.isArray(files) && files.length > 0) {
                        const file = files[0];
                        if (file === process.argv[0] || path.basename(file).includes("client")) {
                            // alert(win, messages.wrong_engine_exe);
                            win.webContents.send("call", "send_ack_engine"); // Force an ack IPC to fix our menu check state.
                            return;
                        }
                        handler.onChangeEngine(file);
                        // e.g. /usr/games/stockfish
                        console.log(`file: ${file}`);
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
