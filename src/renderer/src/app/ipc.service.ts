import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { DtoSystemInfo } from "../../../ipc-dtos/dtosysteminfo";

declare global {
    interface Window {
        api: {
            /** Electron ipcRenderer wrapper of send method */
            electronIpcSend: (channel: string, ...arg: any) => void;
            /** Electron ipcRenderer wrapper of sendSync method */
            electronIpcSendSync: (channel: string, ...arg: any) => any;
            /** Electron ipcRenderer wrapper of on method */
            electronIpcOn: (channel: string, listener: (event: any, ...arg: any) => void) => void;
            /** Electron ipcRenderer wrapper of onOnce method */
            electronIpcOnce: (channel: string, listener: (event: any, ...arg: any) => void) => void;
            /** Electron ipcRenderer wrapper of removeListener method */
            electronIpcRemoveListener: (channel: string, listener: (event: any, arg: any) => void) => void;
            /** Electron ipcRenderer wrapper of removeAllListeners method */
            electronIpcRemoveAllListeners: (channel: string) => void;
        };
    }
}

@Injectable({
    providedIn: "root"
})
export class IpcService {
    constructor() { }

    openDevTools() {
        window.api.electronIpcSend("dev-tools");
    }

    getSystemInfoAsync(): Observable<DtoSystemInfo> {
        return new Observable((subscriber) => {
            window.api.electronIpcOnce("systeminfo", (event, arg) => {
                const systemInfo: DtoSystemInfo = DtoSystemInfo.deserialize(arg);
                subscriber.next(systemInfo);
                subscriber.complete();
            });
            window.api.electronIpcSend("request-systeminfo");
        });
    }
}
