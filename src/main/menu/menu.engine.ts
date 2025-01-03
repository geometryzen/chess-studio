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
                            return;
                        }
                        handler.switch_engine(file);
                        win.webContents.send(CHANNEL_ENGINE_CHANGED, file);
                        // e.g. /usr/games/stockfish
                    } else {
                    }
                }
            }
        ]
    };
    return items;
}
