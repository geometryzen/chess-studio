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

contextBridge.exposeInMainWorld("versions", {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
    // we can also expose variables, not just functions
});

contextBridge.exposeInMainWorld("electron", {
    send: (channel: string, data: any) => {
        ipcRenderer.send(channel, data);
    },
    on: (channel: string, func: (...args: any[]) => void) => {
        const newFunc = (...args: any[]) => func(...args);
        ipcRenderer.on(channel, newFunc);
    },
    sendSync: (channel: string, data: any) => {
        return ipcRenderer.sendSync(channel, data);
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
        ipcRenderer.removeListener(channel, func);
    }
});
