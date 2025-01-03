import { BrowserWindow, MenuItemConstructorOptions, dialog } from "electron";
import * as path from "path";
import { CHANNEL_ENGINE_CHANGED } from "../../shared/ipc-constants";
import { MenuHandler } from "./menu";

const open_dialog = dialog.showOpenDialogSync || dialog.showOpenDialog;

export function menu_engine(win: BrowserWindow, handler: MenuHandler): MenuItemConstructorOptions {
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
