// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// This script exposes specific Electron APIs to the Angular window.

import { contextBridge, ipcRenderer } from "electron";

// The following makes versions a global that is accessible in the render process.
// "foobar" is referred to as an apiKey and the object is an api.
// "foobar" is the name of a property on window in render process.
contextBridge.exposeInMainWorld("foobar", {
    baz: (name: string) => {
        // "bazzo" is referred to as a channel.
        return ipcRenderer.invoke("bazzo", name);
    }
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
