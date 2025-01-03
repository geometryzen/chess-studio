import { BrowserWindow, Menu, MenuItemConstructorOptions } from "electron";
import { menu_analysis } from "./menu.analysis";
import { menu_board } from "./menu.board";
import { menu_engine } from "./menu.engine";
import { menu_file } from "./menu.file";
import { menu_help } from "./menu.help";
import { menu_tree } from "./menu.tree";

export interface MenuHandler {
    getEngineFolder(): string | undefined;
    setEngineFolder(engineFolder: string): void;
    restart_engine(): Promise<void>;
    switch_engine(file: string): Promise<void>;
}

export function menu_build(win: BrowserWindow, handler: MenuHandler): Menu {
    const template: MenuItemConstructorOptions[] = [menu_file(win), menu_tree(win), menu_analysis(win), menu_board(win), menu_engine(win, handler), menu_help()];
    return Menu.buildFromTemplate(template);
}
