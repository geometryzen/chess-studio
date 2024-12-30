import { app, BrowserWindow, ipcMain, Menu } from "electron";
import log from "electron-log/main";
import * as os from "os";
import * as path from "path";
import { Controller } from "./controller";
import { DtoSystemInfo } from "./dtosysteminfo";
import { Engine } from "./engine/Engine";
import { menu_build } from "./menu/menu";

// Optional, initialize the logger for any renderer process
log.initialize();

log.info("Log from the main process");

const engine = new Engine();

let win: BrowserWindow | null = null;

app.on("ready", createWindow);

app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
});

function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 1000,
        resizable: true,
        webPreferences: {
            // Disabled Node integration
            nodeIntegration: false,
            // protect against prototype pollution
            contextIsolation: true,
            // Preload script
            preload: path.join(app.getAppPath(), "dist/preload", "preload.js")
        }
    });

    const controller = new Controller();

    controller.restart_engine();

    const menu = menu_build(win, controller);

    // https://stackoverflow.com/a/58548866/600559
    Menu.setApplicationMenu(menu);

    if (app.isPackaged) {
        win.loadFile(path.join(app.getAppPath(), "dist/renderer/browser", "index.html"));
    } else {
        win.loadFile(path.join(app.getAppPath(), "dist/renderer/browser", "index.html"));
        // win.loadURL(`http://localhost:4200`);
    }

    win.on("closed", () => {
        win = null;
    });
}

ipcMain.on("dev-tools", () => {
    if (win) {
        win.webContents.toggleDevTools();
    }
});

ipcMain.on("request-systeminfo", () => {
    const systemInfo = new DtoSystemInfo();
    systemInfo.Arch = os.arch();
    systemInfo.Hostname = os.hostname();
    systemInfo.Platform = os.platform();
    systemInfo.Release = os.release();
    const serializedString = systemInfo.serialize();
    if (win) {
        win.webContents.send("systeminfo", serializedString);
    }
});

ipcMain.handle("bazzo", (event, arg0, arg1, arg2) => {
    console.log(`bazzo! ${arg0}`);
    return 43;
});
