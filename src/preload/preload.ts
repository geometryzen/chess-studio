// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// This script exposes specific Electron APIs to the Angular window.

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { CHANNEL_ACTION_BOARD_FLIP, CHANNEL_ACTION_GAME_CLEAR, CHANNEL_ACTION_GAME_ENTER_MODE_SETUP, CHANNEL_ACTION_GAME_EXIT_MODE_SETUP, CHANNEL_ACTION_GAME_NEW, CHANNEL_ENGINE_CHANGED } from "../shared/ipc-constants";

// The following makes versions a global that is accessible in the render process.
// "foobar" is referred to as an apiKey and the object is an api.
// "foobar" is the name of a property on window in render process.
contextBridge.exposeInMainWorld("foobar", {
    baz: (name: string) => {
        // "bazzo" is referred to as a channel.
        return ipcRenderer.invoke("bazzo", name);
    },
    onNewGameClassic: (callback: () => void) => ipcRenderer.on(CHANNEL_ACTION_GAME_NEW, (_event: IpcRendererEvent) => callback()),
    onGameClear: (callback: () => void) => ipcRenderer.on(CHANNEL_ACTION_GAME_CLEAR, (_event: IpcRendererEvent) => callback()),
    onGameSetup: (callback: () => void) => ipcRenderer.on(CHANNEL_ACTION_GAME_ENTER_MODE_SETUP, (_event: IpcRendererEvent) => callback()),
    onGamePlay: (callback: () => void) => ipcRenderer.on(CHANNEL_ACTION_GAME_EXIT_MODE_SETUP, (_event: IpcRendererEvent) => callback()),
    onBoardFlip: (callback: () => void) => ipcRenderer.on(CHANNEL_ACTION_BOARD_FLIP, (_event: IpcRendererEvent) => callback()),
    onEngineChange: (callback: (filename: string) => void) => ipcRenderer.on(CHANNEL_ENGINE_CHANGED, (_event: IpcRendererEvent, value: string) => callback(value))
});

contextBridge.exposeInMainWorld("api", {
    electronIpcSend: (channel: string, ...arg: any) => {
        ipcRenderer.send(channel, arg);
    },
    electronIpcSendSync: (channel: string, ...arg: any) => {
        return ipcRenderer.sendSync(channel, arg);
    },
    electronIpcOn: (channel: string, listener: (event: any, ...arg: any) => void) => {
        ipcRenderer.on(channel, listener);
    },
    electronIpcOnce: (channel: string, listener: (event: any, ...arg: any) => void) => {
        ipcRenderer.once(channel, listener);
    },
    electronIpcRemoveListener: (channel: string, listener: (event: any, ...arg: any) => void) => {
        ipcRenderer.removeListener(channel, listener);
    },
    electronIpcRemoveAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
