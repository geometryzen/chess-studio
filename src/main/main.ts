import { app, BrowserWindow, ipcMain, Menu } from "electron";
import log from "electron-log/main";
import { BestMove } from "engine/parseBestmove";
import { Info } from "engine/parseInfo";
import * as os from "os";
import * as path from "path";
import { CHANNEL_EVENT_ANALYSIS_MOVE_CANDIDATE, CHANNEL_EVENT_ANALYSIS_MOVE_SCORE, CHANNEL_INVOKE_ANALYSIS_GO, CHANNEL_INVOKE_ANALYSIS_HALT, CHANNEL_INVOKE_BAZZO } from "../shared/ipc-constants";
import { Controller } from "./controller";
import { DtoSystemInfo } from "./dtosysteminfo";
import { menu_build } from "./menu/menu";

// Optional, initialize the logger for any renderer process
log.initialize();

log.info("Log from the main process");

let win: BrowserWindow | null = null;

app.on("ready", createWindow);

app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
});

async function createWindow() {
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

    const controller = new Controller(app);

    ipcMain.handle(CHANNEL_INVOKE_BAZZO, (event, arg0, arg1, arg2) => {
        console.log(`bazzo! ${arg0}`);
        return 43;
    });

    ipcMain.handle(CHANNEL_INVOKE_ANALYSIS_GO, async (event, fen: string, arg1, arg2) => {
        await controller.engine.isready();
        await controller.engine.position(fen, []);
        controller.engine.go({ infinite: true });
        controller.engine.info$.subscribe(function (info: Info) {
            if (win) {
                if (info["score"]) {
                    win.webContents.send(CHANNEL_EVENT_ANALYSIS_MOVE_SCORE, info);
                } else {
                    win.webContents.send(CHANNEL_EVENT_ANALYSIS_MOVE_CANDIDATE, info);
                }
            }
            console.log(JSON.stringify(info));
        });
        controller.engine.bestmove$.subscribe(function (bestmove: BestMove) {
            console.log(JSON.stringify(bestmove));
        });
        console.log(`go! ${fen}`);
    });

    ipcMain.handle(CHANNEL_INVOKE_ANALYSIS_HALT, async (event, arg0, arg1, arg2) => {
        const response: BestMove = await controller.engine.stop();
        console.log(`halt! ${JSON.stringify(response)}`);
        return response;
    });

    await controller.restart_engine();

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
