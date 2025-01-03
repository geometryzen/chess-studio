import { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { CHANNEL_ACTION_ANALYSIS_GO, CHANNEL_ACTION_ANALYSIS_HALT } from "../../shared/ipc-constants";

export function menu_analysis(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Analysis",
        submenu: [
            menu_item_analysis_go(win),
            {
                type: "separator"
            },
            menu_item_analysis_halt(win)
        ]
    };
    return items;
}

function menu_item_analysis_go(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Go",
        accelerator: "CommandOrControl+G",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_ANALYSIS_GO);
        }
    };
    return items;
}

function menu_item_analysis_halt(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Halt",
        accelerator: "CommandOrControl+H",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_ANALYSIS_HALT);
        }
    };
    return items;
}
