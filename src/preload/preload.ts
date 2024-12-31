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

/**
 * The preload script runs before. It has access to web APIs
 * as well as Electron's renderer process modules and some
 * polyfilled Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-preload
 */

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
    return new Promise(resolve => {
        if (condition.includes(document.readyState)) {
            resolve(true)
        } else {
            document.addEventListener('readystatechange', () => {
                if (condition.includes(document.readyState)) {
                    resolve(true)
                }
            })
        }
    })
}

const safeDOM = {
    append(parent: HTMLElement, child: HTMLElement) {
        if (!Array.from(parent.children).find(e => e === child)) {
            parent.appendChild(child)
        }
    },
    remove(parent: HTMLElement, child: HTMLElement) {
        if (Array.from(parent.children).find(e => e === child)) {
            parent.removeChild(child)
        }
    },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
    const className = `loaders-css__square-spin`
    const styleContent = `
  @keyframes square-spin {
    25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
    50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
    75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
    100% { transform: perspective(100px) rotateX(0) rotateY(0); }
  }
  .${className} > div {
    animation-fill-mode: both;
    width: 50px;
    height: 50px;
    background: #fff;
    animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
  }
  .app-loading-wrap {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #282c34;
    z-index: 9;
  }
      `
    const oStyle = document.createElement('style')
    const oDiv = document.createElement('div')

    oStyle.id = 'app-loading-style'
    oStyle.innerHTML = styleContent
    oDiv.className = 'app-loading-wrap'
    oDiv.innerHTML = `<div class="${className}"><div></div></div>`

    return {
        appendLoading() {
            safeDOM.append(document.head, oStyle)
            safeDOM.append(document.body, oDiv)
        },
        removeLoading() {
            safeDOM.remove(document.head, oStyle)
            safeDOM.remove(document.body, oDiv)
        },
    }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev: MessageEvent) => {
    if (ev.data.payload === 'removeLoading') {
        removeLoading()
    }
}

setTimeout(removeLoading, 4999)
