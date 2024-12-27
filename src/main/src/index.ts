import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
import * as os from "os";
import * as path from "path";
import { DtoSystemInfo } from "./dtosysteminfo";
import { Engine } from "./engine/Engine.js";
import { Config, load } from "./modules/config_io.js";

let config: Config = load()[1];

const engine = new Engine();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

let win: BrowserWindow | null = null;

app.on("ready", createWindow);

app.on("activate", () => {
    if (win === null) {
        createWindow();
    }
});

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
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

    // https://stackoverflow.com/a/58548866/600559
    // Menu.setApplicationMenu(null);

    //
    // win.loadFile(path.join(app.getAppPath(), "dist/renderer/browser", "index.html"));
    /*
    const packagedStartURL = url.format({
        pathname: path.join(__dirname, "chessstudio", "index.html"),
        protocol: "file:",
        slashes: true
    });
    */

    // const startURL = app.isPackaged ? packagedStartURL : `http://localhost:4200`;

    // win.loadURL(startURL);

    // Allow Page reload when not packaged.
    if (app.isPackaged) {
        win.loadFile(path.join(app.getAppPath(), "dist/renderer/browser", "index.html"));
    }
    else {
        win.loadURL(`http://localhost:4200`);
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
    return 42;
});

