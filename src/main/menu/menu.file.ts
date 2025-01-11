import { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { CHANNEL_ACTION_GAME_CLEAR, CHANNEL_ACTION_GAME_ENTER_MODE_SETUP, CHANNEL_ACTION_GAME_EXIT_MODE_SETUP, CHANNEL_ACTION_GAME_NEW } from "../../shared/ipc-constants";

export function menu_file(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "File",
        submenu: [
            menu_item_game_new(win),
            menu_item_game_clear(win),
            menu_item_game_setup(win),
            menu_item_game_play(win),
            {
                type: "separator"
            },
            {
                label: "Exit",
                accelerator: "CommandOrControl+Q",
                role: "quit"
            }
        ]
    };
    return items;
}

function menu_item_game_new(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "New Game",
        accelerator: "CommandOrControl+N",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_GAME_NEW);
        }
    };
    return items;
}

function menu_item_game_clear(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Clear",
        accelerator: "CommandOrControl+M",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_GAME_CLEAR);
        }
    };
    return items;
}

function menu_item_game_setup(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Enter Setup Mode",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_GAME_ENTER_MODE_SETUP);
        }
    };
    return items;
}

function menu_item_game_play(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Exit Setup Mode",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_GAME_EXIT_MODE_SETUP);
        }
    };
    return items;
}
