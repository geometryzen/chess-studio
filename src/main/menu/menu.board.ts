import { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { CHANNEL_ACTION_BOARD_FLIP } from "../../shared/ipc-constants";

export function menu_board(win: BrowserWindow): MenuItemConstructorOptions {
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
